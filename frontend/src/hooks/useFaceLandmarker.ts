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
 * pinned or spotlighted), so we score by bounding-box area with a centeredness
 * tiebreak rather than taking an arbitrary first face.
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

/**
 * Runs MediaPipe Face Landmarker on the candidate's Google Meet video (from
 * getDisplayMedia tab capture) in the browser via WASM (zero install) and emits
 * normalized gaze/blink samples. Gaze is derived from eye-look blendshapes;
 * blinks from eyeBlink blendshapes. Downward gaze (gaze_y > 0) flags a
 * candidate reading notes / a second screen during a remote call.
 *
 * Uses an internal hidden <video> so analysis does not depend on the UI
 * preview being mounted. An optional preview element can mirror the same stream
 * via registerVideo.
 *
 * Eye tracking is intentionally supporting-only evidence downstream.
 */
export function useFaceLandmarker({ stream, enabled, emit, hz = 8 }: Options) {
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
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

    let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
    let raf = 0;
    let cancelled = false;
    let lastEmit = 0;
    const minInterval = 1 / hz;

    // Internal offscreen video - landmarker never depends on the UI preview.
    let video = analysisVideoRef.current;
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.style.position = "fixed";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      video.style.bottom = "0";
      video.style.right = "0";
      document.body.appendChild(video);
      analysisVideoRef.current = video;
    }
    video.srcObject = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      previewRef.current.play().catch(() => undefined);
    }

    const setup = async () => {
      setStatus((s) => ({
        ...s,
        loading: true,
        error: null,
        hasVideo: true,
      }));
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 3, // Meet may show several tiles; we select the candidate.
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
        await video!.play().catch(() => undefined);
        if (cancelled) return;
        setStatus((s) => ({ ...s, ready: true, loading: false, hasVideo: true }));
        loop();
      } catch (e) {
        setStatus((s) => ({
          ...s,
          loading: false,
          hasVideo: true,
          error: e instanceof Error ? e.message : "Face model failed to load",
        }));
      }
    };

    const loop = () => {
      if (cancelled || !landmarker || !video) return;
      raf = requestAnimationFrame(loop);
      if (video.readyState < 2) return;

      const now = nowSeconds();
      if (now - lastEmit < minInterval) return;

      let result;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch {
        return;
      }
      lastEmit = now;

      const faces = result.faceLandmarks ?? [];
      const faceVisible =
        faces.length > 0 && (result.faceBlendshapes?.length ?? 0) > 0;

      if (!faceVisible) {
        const ev: GazeEvent = {
          type: "gaze",
          ts: now,
          face_visible: false,
          on_screen: false,
          blink: false,
          gaze_x: 0,
          gaze_y: 0,
        };
        emitRef.current(ev);
        setStatus((s) => ({ ...s, faceVisible: false, lastGaze: ev }));
        return;
      }

      // Choose the candidate face (largest / most centered in the Meet frame).
      const idx = pickCandidateFace(faces);
      const cats = result.faceBlendshapes![idx]?.categories ?? [];
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
      // Looking clearly down (notes / second screen) is off-camera engagement.
      const on_screen = Math.abs(gaze_x) < 0.55 && gaze_y < 0.35;

      const ev: GazeEvent = {
        type: "gaze",
        ts: now,
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
      setStatus((s) => ({ ...s, faceVisible: true, lastGaze: ev }));
    };

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      landmarker?.close();
      if (video) {
        video.srcObject = null;
      }
      if (previewRef.current) {
        previewRef.current.srcObject = null;
      }
    };
  }, [enabled, stream, hz]);

  // Tear down the hidden analysis video on unmount.
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
