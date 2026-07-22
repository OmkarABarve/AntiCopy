"use client";

import { useCallback, useState } from "react";

export type PermissionState = "idle" | "requesting" | "granted" | "denied";

export interface CaptureState {
  mic: PermissionState;
  /** Local webcam is unused for remote Meet gaze; kept for status UI only. */
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
 *  - getUserMedia: interviewer microphone only (speaker energy attribution).
 *    Local webcam is NOT used for gaze - candidate gaze comes from the Meet
 *    tab video via getDisplayMedia below.
 *  - getDisplayMedia: Google Meet tab video (candidate gaze) + tab audio.
 * Zero install, browser permissions only.
 */
export function useMediaCapture() {
  const [permissions, setPermissions] = useState<CaptureState>({
    mic: "idle",
    camera: "idle",
    display: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<CaptureStreams>({
    cameraStream: null,
    micStream: null,
    displayStream: null,
  });

  /** Interviewer mic for speech attribution. No local webcam needed for gaze. */
  const requestMic = useCallback(async () => {
    setError(null);
    setPermissions((p) => ({ ...p, mic: "requesting", camera: "idle" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      setStreams((s) => ({
        ...s,
        cameraStream: null,
        micStream: new MediaStream(stream.getAudioTracks()),
      }));
      setPermissions((p) => ({ ...p, mic: "granted", camera: "idle" }));
      return true;
    } catch (e) {
      setPermissions((p) => ({ ...p, mic: "denied" }));
      setError(e instanceof Error ? e.message : "Microphone denied");
      return false;
    }
  }, []);

  /** @deprecated Prefer requestMic - local webcam is unused for Meet gaze. */
  const requestCameraAndMic = requestMic;

  const requestDisplay = useCallback(async () => {
    setError(null);
    setPermissions((p) => ({ ...p, display: "requesting" }));
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Usable FPS for gaze/blink on the candidate's Meet video (not a
        // screenshot cadence).
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: true, // Meet tab / system audio for candidate speech
      });
      // If the user stops sharing via the browser UI, reflect that.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setStreams((s) => ({ ...s, displayStream: null }));
        setPermissions((p) => ({ ...p, display: "idle" }));
      });
      setStreams((s) => ({ ...s, displayStream: stream }));
      setPermissions((p) => ({ ...p, display: "granted" }));
      return true;
    } catch (e) {
      setPermissions((p) => ({ ...p, display: "denied" }));
      setError(e instanceof Error ? e.message : "Screen capture denied");
      return false;
    }
  }, []);

  const stopAll = useCallback(() => {
    setStreams((s) => {
      [s.cameraStream, s.micStream, s.displayStream].forEach((st) =>
        st?.getTracks().forEach((t) => t.stop()),
      );
      return { cameraStream: null, micStream: null, displayStream: null };
    });
    setPermissions({ mic: "idle", camera: "idle", display: "idle" });
  }, []);

  return {
    permissions,
    error,
    streams,
    requestMic,
    requestCameraAndMic,
    requestDisplay,
    stopAll,
  };
}
