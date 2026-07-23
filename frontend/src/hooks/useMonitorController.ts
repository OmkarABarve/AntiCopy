"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InboundEvent, QuestionType } from "@/lib/types";
import { nowSeconds } from "@/lib/utils";
import {
  startSimulation,
  type SimulationHandle,
  type SimulationProfile,
} from "@/lib/simulation";
import { useActivityEvents } from "./useActivityEvents";
import { useFaceLandmarker } from "./useFaceLandmarker";
import { useMediaCapture } from "./useMediaCapture";
import { useMonitorSocket } from "./useMonitorSocket";
import { useSpeechTranscription } from "./useSpeechTranscription";

export type MonitorMode = "idle" | "live" | "simulation";

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `sess-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `sess-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Top-level orchestrator: owns the session, wires every capture hook to the
 * WebSocket sink, and can swap in the deterministic simulation instead of live
 * capture. This is the single seam the monitoring console talks to.
 */
export function useMonitorController() {
  // Stable empty on SSR + first client paint; assign a random id after mount
  // so the dashboard link doesn't hydrate-mismatch.
  const [sessionId, setSessionId] = useState("");
  const [mode, setMode] = useState<MonitorMode>("idle");

  useEffect(() => {
    setSessionId(makeSessionId());
  }, []);

  const capture = useMediaCapture();
  const simRef = useRef<SimulationHandle | null>(null);

  const socket = useMonitorSocket({
    sessionId: sessionId || "pending",
    enabled: mode !== "idle" && !!sessionId,
  });
  const sendRef = useRef(socket.send);
  useEffect(() => {
    sendRef.current = socket.send;
  }, [socket.send]);

  const emit = useCallback((event: InboundEvent) => {
    sendRef.current(event);
  }, []);

  const live = mode === "live";

  // Live capture pipelines (only active in live mode).
  // Gaze runs on the candidate's Google Meet video from getDisplayMedia (tab
  // capture), NOT the interviewer's local webcam - this is a remote interview.
  const face = useFaceLandmarker({
    stream: capture.streams.displayStream,
    enabled: live,
    emit,
  });
  const speech = useSpeechTranscription({
    micStream: capture.streams.micStream,
    displayStream: capture.streams.displayStream,
    enabled: live,
    emit,
  });
  useActivityEvents(emit, live);

  const startLive = useCallback(async () => {
    // Mic is required for interviewer speech attribution; Meet tab (display)
    // is required for candidate gaze on the remote video. Local webcam is
    // intentionally not used for gaze in a remote interview.
    const okMic = await capture.requestMic();
    if (!okMic) return false;
    const okDisplay = await capture.requestDisplay();
    if (!okDisplay) {
      // Without Meet tab video we cannot run candidate gaze. Stop mic and
      // surface the failure rather than starting a half-broken live session.
      capture.stopAll();
      return false;
    }
    emit({ type: "control", action: "reset" });
    emit({ type: "control", action: "start" });
    setMode("live");
    return true;
  }, [capture, emit]);

  const startSimulationMode = useCallback(
    (profile: SimulationProfile) => {
      setMode("simulation");
      // Delay so the socket is connected before the burst begins.
      window.setTimeout(() => {
        simRef.current?.stop();
        simRef.current = startSimulation(emit, profile);
      }, 350);
    },
    [emit],
  );

  const stop = useCallback(() => {
    simRef.current?.stop();
    simRef.current = null;
    capture.stopAll();
    emit({ type: "control", action: "stop" });
    setMode("idle");
  }, [capture, emit]);

  const tagQuestion = useCallback(
    (question_type: QuestionType) => {
      emit({ type: "question", ts: nowSeconds(), question_type });
    },
    [emit],
  );

  useEffect(() => {
    return () => {
      simRef.current?.stop();
    };
  }, []);

  return useMemo(
    () => ({
      sessionId,
      mode,
      connection: socket.status,
      state: socket.state,
      capture,
      face,
      speech,
      startLive,
      startSimulationMode,
      stop,
      tagQuestion,
    }),
    [
      sessionId,
      mode,
      socket.status,
      socket.state,
      capture,
      face,
      speech,
      startLive,
      startSimulationMode,
      stop,
      tagQuestion,
    ],
  );
}

export type MonitorController = ReturnType<typeof useMonitorController>;
