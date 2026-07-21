"use client";

import { useCallback, useRef, useState } from "react";

export type PermissionState = "idle" | "requesting" | "granted" | "denied";

export interface CaptureState {
  mic: PermissionState;
  camera: PermissionState;
  display: PermissionState;
}

export interface CaptureStreams {
  cameraStream: MediaStream | null;
  micStream: MediaStream | null;
  displayStream: MediaStream | null;
}

/**
 * Owns all browser media permissions/streams:
 *  - getUserMedia: microphone + candidate camera (for gaze analysis)
 *  - getDisplayMedia: Google Meet tab video + tab audio
 * Zero install, browser permissions only.
 */
export function useMediaCapture() {
  const [permissions, setPermissions] = useState<CaptureState>({
    mic: "idle",
    camera: "idle",
    display: "idle",
  });
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const displayRef = useRef<MediaStream | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const requestCameraAndMic = useCallback(async () => {
    setError(null);
    setPermissions((p) => ({ ...p, camera: "requesting", mic: "requesting" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Split tracks so gaze (video) and VAD/ASR (audio) can be handled apart.
      cameraRef.current = new MediaStream(stream.getVideoTracks());
      micRef.current = new MediaStream(stream.getAudioTracks());
      setPermissions((p) => ({ ...p, camera: "granted", mic: "granted" }));
      rerender();
      return true;
    } catch (e) {
      setPermissions((p) => ({ ...p, camera: "denied", mic: "denied" }));
      setError(e instanceof Error ? e.message : "Camera/microphone denied");
      return false;
    }
  }, []);

  const requestDisplay = useCallback(async () => {
    setError(null);
    setPermissions((p) => ({ ...p, display: "requesting" }));
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: true, // request tab/system audio (the meeting audio)
      });
      displayRef.current = stream;
      // If the user stops sharing via the browser UI, reflect that.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        displayRef.current = null;
        setPermissions((p) => ({ ...p, display: "idle" }));
        rerender();
      });
      setPermissions((p) => ({ ...p, display: "granted" }));
      rerender();
      return true;
    } catch (e) {
      setPermissions((p) => ({ ...p, display: "denied" }));
      setError(e instanceof Error ? e.message : "Screen capture denied");
      return false;
    }
  }, []);

  const stopAll = useCallback(() => {
    for (const ref of [cameraRef, micRef, displayRef]) {
      ref.current?.getTracks().forEach((t) => t.stop());
      ref.current = null;
    }
    setPermissions({ mic: "idle", camera: "idle", display: "idle" });
    rerender();
  }, []);

  const streams: CaptureStreams = {
    cameraStream: cameraRef.current,
    micStream: micRef.current,
    displayStream: displayRef.current,
  };

  return {
    permissions,
    error,
    streams,
    requestCameraAndMic,
    requestDisplay,
    stopAll,
  };
}
