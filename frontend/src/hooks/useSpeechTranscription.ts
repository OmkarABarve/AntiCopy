"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEvent, Speaker, TranscriptEvent } from "@/lib/types";
import { nowSeconds } from "@/lib/utils";

type Emit = (event: TranscriptEvent | ActivityEvent) => void;

/** RMS above this on both mic and tab counts as "talking". */
const ENERGY_HIGH = 0.015;
/** Both sides must stay high this long before one overlap episode is emitted. */
const OVERLAP_HOLD_S = 0.4;

interface Options {
  micStream: MediaStream | null;
  displayStream: MediaStream | null;
  enabled: boolean;
  emit: Emit;
}

export interface TranscriptionStatus {
  supported: boolean;
  listening: boolean;
  error: string | null;
  micEnergy: number;
  tabEnergy: number;
  interim: string;
  /** True when the Meet tab MediaStream includes an audio track. */
  hasTabAudio: boolean;
}

// Minimal typings for the (still non-standard) Web Speech API.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onspeechstart: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; 0: { transcript: string } };
  };
}

function makeAnalyser(ctx: AudioContext, stream: MediaStream | null) {
  if (!stream || stream.getAudioTracks().length === 0) return null;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);
  return { source, analyser };
}

function rms(analyser: AnalyserNode | null, buf: Uint8Array): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(buf as Uint8Array<ArrayBuffer>);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * Live transcription via the browser Web Speech API.
 *
 * Important limitation: Chromium's Web Speech API only hears the *microphone*,
 * not an arbitrary MediaStream. Candidate (Meet tab) speech is attributed when
 * tab energy >> mic energy at finalization time — which works when tab audio is
 * audible to the mic, or when the interviewer mic picks up speaker output.
 * Tab audio is always used for energy / voice-overlap and speaker hints.
 */
export function useSpeechTranscription({
  micStream,
  displayStream,
  enabled,
  emit,
}: Options) {
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  const [status, setStatus] = useState<TranscriptionStatus>({
    supported: true,
    listening: false,
    error: null,
    micEnergy: 0,
    tabEnergy: 0,
    interim: "",
    hasTabAudio: false,
  });

  const energyRef = useRef({ mic: 0, tab: 0 });
  const segStartRef = useRef<number>(0);
  const displayStreamRef = useRef(displayStream);
  displayStreamRef.current = displayStream;

  // --- Energy + voice-overlap (can follow stream changes without killing ASR) --- //
  useEffect(() => {
    if (!enabled) {
      setStatus((s) => ({
        ...s,
        micEnergy: 0,
        tabEnergy: 0,
        hasTabAudio: false,
      }));
      return;
    }

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    void ctx.resume().catch(() => undefined);

    let micNode = makeAnalyser(ctx, micStream);
    let tabNode = makeAnalyser(ctx, displayStream);
    let currentDisplay = displayStream;
    const buf = new Uint8Array(512);
    let raf = 0;
    let overlapStart: number | null = null;
    let overlapEmitted = false;
    let lastUi = 0;

    const hasTabAudio =
      !!displayStream && displayStream.getAudioTracks().length > 0;
    setStatus((s) => ({ ...s, hasTabAudio }));

    // Keep a silent sink so some browsers keep the tab-audio track alive.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    silent.connect(ctx.destination);
    tabNode?.source.connect(silent);

    const measure = () => {
      // Hot-swap tab analyser if the display stream object changed mid-session.
      const latest = displayStreamRef.current;
      if (latest && latest !== currentDisplay) {
        try {
          tabNode?.source.disconnect();
        } catch {
          /* ignore */
        }
        tabNode = makeAnalyser(ctx, latest);
        tabNode?.source.connect(silent);
        currentDisplay = latest;
        setStatus((s) => ({
          ...s,
          hasTabAudio: latest.getAudioTracks().length > 0,
        }));
      }

      const mic = rms(micNode?.analyser ?? null, buf);
      const tab = rms(tabNode?.analyser ?? null, buf);
      energyRef.current.mic = energyRef.current.mic * 0.7 + mic * 0.3;
      energyRef.current.tab = energyRef.current.tab * 0.7 + tab * 0.3;

      const now = nowSeconds();
      const bothHigh =
        energyRef.current.mic > ENERGY_HIGH &&
        energyRef.current.tab > ENERGY_HIGH;
      if (bothHigh) {
        if (overlapStart === null) overlapStart = now;
        else if (!overlapEmitted && now - overlapStart >= OVERLAP_HOLD_S) {
          emitRef.current({
            type: "activity",
            ts: now,
            kind: "voice_overlap",
          });
          overlapEmitted = true;
        }
      } else {
        overlapStart = null;
        overlapEmitted = false;
      }

      const t = performance.now();
      if (t - lastUi > 200) {
        lastUi = t;
        setStatus((s) => ({
          ...s,
          micEnergy: energyRef.current.mic,
          tabEnergy: energyRef.current.tab,
        }));
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(raf);
      try {
        micNode?.source.disconnect();
        tabNode?.source.disconnect();
        silent.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => undefined);
    };
  }, [enabled, micStream, displayStream]);

  // --- Web Speech recognition (stable; do not restart on displayStream change) --- //
  useEffect(() => {
    if (!enabled || !micStream) {
      setStatus((s) => ({ ...s, listening: false }));
      return;
    }

    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;

    if (!Ctor) {
      setStatus((s) => ({
        ...s,
        supported: false,
        listening: false,
        error:
          "Web Speech API not available. Use Chrome/Edge, or Demo mode.",
      }));
      return;
    }

    let recognition: SpeechRecognitionLike | null = null;
    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startRecognition = () => {
      if (stopped || !recognition) return;
      try {
        recognition.start();
        setStatus((s) => ({ ...s, listening: true, error: null }));
      } catch {
        // Already started — ignore.
      }
    };

    recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    if (typeof recognition.maxAlternatives === "number") {
      recognition.maxAlternatives = 1;
    }

    recognition.onspeechstart = () => {
      segStartRef.current = nowSeconds();
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0].transcript.trim();
        if (!text) continue;
        if (res.isFinal) {
          const ts_end = nowSeconds();
          const ts_start =
            segStartRef.current || ts_end - text.split(/\s+/).length / 2.5;
          // Prefer tab energy when Meet audio is clearly louder (candidate).
          const { mic, tab } = energyRef.current;
          const speaker: Speaker =
            tab > 0.01 && tab > mic * 1.1 ? "candidate" : "interviewer";
          emitRef.current({
            type: "transcript",
            speaker,
            text,
            ts_start,
            ts_end,
            is_final: true,
          });
          segStartRef.current = 0;
        } else {
          interim += text + " ";
        }
      }
      setStatus((s) => ({ ...s, interim: interim.trim(), listening: true }));
    };

    recognition.onerror = (e: { error: string }) => {
      // Recoverable: keep session alive.
      if (
        e.error === "no-speech" ||
        e.error === "aborted" ||
        e.error === "network"
      ) {
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setStatus((s) => ({
          ...s,
          listening: false,
          error: "Microphone blocked for speech recognition — allow mic access",
        }));
        stopped = true;
        return;
      }
      if (e.error === "audio-capture") {
        setStatus((s) => ({
          ...s,
          error: "No microphone for speech recognition",
        }));
        return;
      }
      setStatus((s) => ({ ...s, error: e.error }));
    };

    recognition.onend = () => {
      if (stopped) {
        setStatus((s) => ({ ...s, listening: false }));
        return;
      }
      // Chrome ends recognition periodically in continuous mode — restart.
      restartTimer = setTimeout(() => {
        if (!stopped) startRecognition();
      }, 200);
    };

    startRecognition();

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        recognition?.abort?.();
      } catch {
        try {
          recognition?.stop();
        } catch {
          /* ignore */
        }
      }
      setStatus((s) => ({ ...s, listening: false, interim: "" }));
    };
  }, [enabled, micStream]);

  return { status };
}
