"use client";

import { useEffect, useRef, useState } from "react";
import { FACE_LANDMARKER_MODEL, MEDIAPIPE_WASM } from "@/lib/config";
import type { GazeEvent } from "@/lib/types";
import { clamp, nowSeconds } from "@/lib/utils";

type Emit = (event: GazeEvent) => void;

interface Options {
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
}

function blendshape(
  categories: { categoryName: string; score: number }[],
  name: string,
): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0;
}

/**
 * Runs MediaPipe Face Landmarker on the candidate camera stream (browser WASM,
 * zero install) and emits normalized gaze/blink samples. Gaze is derived from
 * eye-look blendshapes; blinks from eyeBlink blendshapes.
 *
 * Eye tracking is intentionally supporting-only evidence downstream.
 */
export function useFaceLandmarker({ stream, enabled, emit, hz = 8 }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const [status, setStatus] = useState<FaceLandmarkerStatus>({
    ready: false,
    loading: false,
    faceVisible: false,
    error: null,
    lastGaze: null,
  });

  useEffect(() => {
    if (!enabled || !stream) return;
    let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
    let raf = 0;
    let cancelled = false;
    let lastEmit = 0;
    const minInterval = 1 / hz;

    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;

    const setup = async () => {
      setStatus((s) => ({ ...s, loading: true, error: null }));
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
        await video.play().catch(() => undefined);
        if (cancelled) return;
        setStatus((s) => ({ ...s, ready: true, loading: false }));
        loop();
      } catch (e) {
        setStatus((s) => ({
          ...s,
          loading: false,
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

      const shapes = result.faceBlendshapes?.[0]?.categories;
      const faceVisible = !!shapes && (result.faceLandmarks?.length ?? 0) > 0;

      if (!faceVisible) {
        const ev: GazeEvent = {
          type: "gaze",
          ts: now,
          on_screen: false,
          blink: false,
          gaze_x: 0,
          gaze_y: 0,
        };
        emitRef.current(ev);
        setStatus((s) => ({ ...s, faceVisible: false, lastGaze: ev }));
        return;
      }

      const cats = shapes!;
      const blink =
        (blendshape(cats, "eyeBlinkLeft") + blendshape(cats, "eyeBlinkRight")) / 2 >
        0.5;

      const rightAmount =
        (blendshape(cats, "eyeLookInLeft") + blendshape(cats, "eyeLookOutRight")) / 2;
      const leftAmount =
        (blendshape(cats, "eyeLookOutLeft") + blendshape(cats, "eyeLookInRight")) / 2;
      const downAmount =
        (blendshape(cats, "eyeLookDownLeft") + blendshape(cats, "eyeLookDownRight")) /
        2;
      const upAmount =
        (blendshape(cats, "eyeLookUpLeft") + blendshape(cats, "eyeLookUpRight")) / 2;

      const gaze_x = clamp((rightAmount - leftAmount) * 1.6, -1, 1);
      const gaze_y = clamp((downAmount - upAmount) * 1.6, -1, 1);
      const on_screen = Math.abs(gaze_x) < 0.55 && Math.abs(gaze_y) < 0.55;

      const ev: GazeEvent = {
        type: "gaze",
        ts: now,
        on_screen,
        blink,
        ear: 1 - (blendshape(cats, "eyeBlinkLeft") + blendshape(cats, "eyeBlinkRight")) / 2,
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
    };
  }, [enabled, stream, hz]);

  return { videoRef, status };
}
