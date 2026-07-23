"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FACE_LANDMARKER_MODEL, MEDIAPIPE_WASM } from "@/lib/config";
import type { GazeEvent } from "@/lib/types";
import { clamp, nowSeconds } from "@/lib/utils";

type Emit = (event: GazeEvent) => void;

interface Options {
  /** Google Meet tab MediaStream from getDisplayMedia (video + optional audio). */
  stream: MediaStream | null;
  enabled: boolean;
  emit: Emit;
  hz?: number; // emission rate
}

export interface FaceLandmarkerStatus {
  ready: boolean;
  loading: boolean;
  faceVisible: boolean;
  error: string | null;
  lastGaze: GazeEvent | null;
  /** True when we have a video track to analyse (Meet tab shared). */
  hasVideo: boolean;
}

function blendshape(
  categories: { categoryName: string; score: number }[],
  name: string,
): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0;
}

/**
 * Pick the best candidate face among all detected faces. In a Google Meet grid
 * the candidate is usually the largest/most-centered face (especially when
 * pinned or spotlighted).
 */
function pickCandidateFace(faces: { x: number; y: number }[][]): number {
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const pts = faces[i];
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const centeredness = 1 - Math.min(1, Math.hypot(cx - 0.5, cy - 0.5) / 0.7);
    const score = area * (0.7 + 0.3 * centeredness);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

async function createLandmarker(
  vision: typeof import("@mediapipe/tasks-vision"),
  fileset: Awaited<
    ReturnType<typeof import("@mediapipe/tasks-vision").FilesetResolver.forVisionTasks>
  >,
) {
  // Prefer CPU — GPU/WebGL with Meet tab capture is a common crash source, and
  // Next.js also surfaces MediaPipe's GPU→CPU fallback INFO logs as "errors".
  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 3,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
  } catch {
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 3,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
  }
}

/**
 * Runs MediaPipe Face Landmarker on the candidate's Google Meet video (from
 * getDisplayMedia tab capture). Emits normalized gaze/blink samples.
 */
export function useFaceLandmarker({ stream, enabled, emit, hz = 5 }: Options) {
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").FaceLandmarker | null>(
    null,
  );
  const registerVideo = useCallback((el: HTMLVideoElement | null) => {
    previewRef.current = el;
    if (el && analysisVideoRef.current?.srcObject) {
      el.srcObject = analysisVideoRef.current.srcObject;
      el.play().catch(() => undefined);
    }
  }, []);
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  const [status, setStatus] = useState<FaceLandmarkerStatus>({
    ready: false,
    loading: false,
    faceVisible: false,
    error: null,
    lastGaze: null,
    hasVideo: false,
  });

  useEffect(() => {
    const hasVideoTrack = !!stream && stream.getVideoTracks().length > 0;
    if (!enabled || !hasVideoTrack) {
      setStatus((s) => ({
        ...s,
        ready: false,
        loading: false,
        faceVisible: false,
        hasVideo: false,
        error: enabled && !hasVideoTrack ? "Meet tab video missing" : null,
      }));
      return;
    }

    let cancelled = false;
    let raf = 0;
    let lastEmit = 0;
    let lastTs = 0;
    let lastStatusAt = 0;
    const minInterval = 1 / hz;

    let video = analysisVideoRef.current;
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("muted", "true");
      // Keep a real pixel size — 1×1 can make MediaPipe fail on some GPUs.
      video.style.position = "fixed";
      video.style.width = "320px";
      video.style.height = "180px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      video.style.bottom = "0";
      video.style.right = "0";
      video.style.zIndex = "-1";
      document.body.appendChild(video);
      analysisVideoRef.current = video;
    }
    video.srcObject = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      previewRef.current.play().catch(() => undefined);
    }

    const waitForFrame = (): Promise<boolean> =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick = () => {
          if (cancelled) {
            resolve(false);
            return;
          }
          if (video && video.readyState >= 2 && video.videoWidth > 0) {
            resolve(true);
            return;
          }
          if (performance.now() - start > 8000) {
            resolve(false);
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });

    const setup = async () => {
      setStatus((s) => ({
        ...s,
        loading: true,
        error: null,
        hasVideo: true,
        ready: false,
      }));
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        const landmarker = await createLandmarker(vision, fileset);
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        await video!.play().catch(() => undefined);
        const ready = await waitForFrame();
        if (cancelled) return;
        if (!ready) {
          setStatus((s) => ({
            ...s,
            loading: false,
            error: "Meet video has no frames yet — pin the candidate and retry",
          }));
          return;
        }

        setStatus((s) => ({ ...s, ready: true, loading: false, hasVideo: true }));
        loop();
      } catch (e) {
        if (cancelled) return;
        setStatus((s) => ({
          ...s,
          loading: false,
          hasVideo: true,
          error: e instanceof Error ? e.message : "Face model failed to load",
        }));
      }
    };

    const publishStatus = (patch: Partial<FaceLandmarkerStatus>, force = false) => {
      const t = performance.now();
      if (!force && t - lastStatusAt < 250) return;
      lastStatusAt = t;
      setStatus((s) => ({ ...s, ...patch }));
    };

    const loop = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);

      const landmarker = landmarkerRef.current;
      if (!landmarker || !video) return;
      if (video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) {
        return;
      }
      // Track ended / muted (user stopped sharing).
      const track = (video.srcObject as MediaStream | null)?.getVideoTracks()?.[0];
      if (track && track.readyState !== "live") return;

      const wall = nowSeconds();
      if (wall - lastEmit < minInterval) return;

      // MediaPipe VIDEO mode requires strictly increasing timestamps (ms).
      const ts = Math.max(performance.now(), lastTs + 1);
      lastTs = ts;

      let result;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch {
        // Swallow WASM/frame errors; keep the loop alive for the next frame.
        return;
      }
      lastEmit = wall;

      const faces = result.faceLandmarks ?? [];
      const faceVisible =
        faces.length > 0 && (result.faceBlendshapes?.length ?? 0) > 0;

      if (!faceVisible) {
        const ev: GazeEvent = {
          type: "gaze",
          ts: wall,
          face_visible: false,
          on_screen: false,
          blink: false,
          gaze_x: 0,
          gaze_y: 0,
        };
        emitRef.current(ev);
        publishStatus({ faceVisible: false, lastGaze: ev });
        return;
      }

      const idx = pickCandidateFace(faces);
      const cats = result.faceBlendshapes![idx]?.categories ?? [];
      if (!cats.length) return;

      const blink =
        (blendshape(cats, "eyeBlinkLeft") + blendshape(cats, "eyeBlinkRight")) /
          2 >
        0.5;

      const rightAmount =
        (blendshape(cats, "eyeLookInLeft") + blendshape(cats, "eyeLookOutRight")) /
        2;
      const leftAmount =
        (blendshape(cats, "eyeLookOutLeft") + blendshape(cats, "eyeLookInRight")) /
        2;
      const downAmount =
        (blendshape(cats, "eyeLookDownLeft") +
          blendshape(cats, "eyeLookDownRight")) /
        2;
      const upAmount =
        (blendshape(cats, "eyeLookUpLeft") + blendshape(cats, "eyeLookUpRight")) /
        2;

      const gaze_x = clamp((rightAmount - leftAmount) * 1.6, -1, 1);
      const gaze_y = clamp((downAmount - upAmount) * 1.6, -1, 1);
      // "On screen" = engaged with the *display*, not looking into the webcam.
      // Laptop cams sit above the Meet window, so mild/moderate downward gaze
      // (watching the call) is still on-screen. Off-screen = strong side look
      // (second monitor) or extreme down (notes below the display).
      const on_screen =
        Math.abs(gaze_x) < 0.65 && gaze_y > -0.5 && gaze_y < 0.7;

      const ev: GazeEvent = {
        type: "gaze",
        ts: wall,
        face_visible: true,
        on_screen,
        blink,
        ear:
          1 -
          (blendshape(cats, "eyeBlinkLeft") + blendshape(cats, "eyeBlinkRight")) /
            2,
        gaze_x: Number(gaze_x.toFixed(3)),
        gaze_y: Number(gaze_y.toFixed(3)),
      };
      emitRef.current(ev);
      publishStatus({ faceVisible: true, lastGaze: ev });
    };

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try {
        landmarkerRef.current?.close();
      } catch {
        /* ignore */
      }
      landmarkerRef.current = null;
      if (video) video.srcObject = null;
      if (previewRef.current) previewRef.current.srcObject = null;
    };
  }, [enabled, stream, hz]);

  useEffect(() => {
    return () => {
      const video = analysisVideoRef.current;
      if (video) {
        video.srcObject = null;
        video.remove();
        analysisVideoRef.current = null;
      }
    };
  }, []);

  return { registerVideo, status };
}
