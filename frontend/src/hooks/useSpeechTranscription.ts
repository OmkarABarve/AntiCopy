"use client";

import { useEffect, useRef, useState } from "react";
import type { Speaker, TranscriptEvent } from "@/lib/types";
import { nowSeconds } from "@/lib/utils";

type Emit = (event: TranscriptEvent) => void;

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
}

// Minimal typings for the (still non-standard) Web Speech API.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
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
  source.connect(analyser);
  return analyser;
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
 * Live transcription via the browser Web Speech API (zero server GPU). Turn
 * detection is automatic (no buttons): each finalized utterance becomes a
 * segment. Speaker attribution compares live mic energy (interviewer) vs tab
 * audio energy (candidate / meeting) at the moment of speech.
 *
 * Known limitation: the Web Speech API transcribes the active microphone, so
 * candidate transcription quality depends on meeting audio being audible. The
 * WhisperLive backend path (see backend/app/whisperlive.py) is the upgrade.
 */
export function useSpeechTranscription({
  micStream,
  displayStream,
  enabled,
  emit,
}: Options) {
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const [status, setStatus] = useState<TranscriptionStatus>({
    supported: true,
    listening: false,
    error: null,
    micEnergy: 0,
    tabEnergy: 0,
    interim: "",
  });

  const energyRef = useRef({ mic: 0, tab: 0 });
  const segStartRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // --- Energy analysers for speaker attribution --- //
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const micAnalyser = makeAnalyser(ctx, micStream);
    const tabAnalyser = makeAnalyser(ctx, displayStream);
    const buf = new Uint8Array(512);
    let raf = 0;
    const measure = () => {
      const mic = rms(micAnalyser, buf);
      const tab = rms(tabAnalyser, buf);
      // Smooth to avoid jitter.
      energyRef.current.mic = energyRef.current.mic * 0.7 + mic * 0.3;
      energyRef.current.tab = energyRef.current.tab * 0.7 + tab * 0.3;
      setStatus((s) => ({
        ...s,
        micEnergy: energyRef.current.mic,
        tabEnergy: energyRef.current.tab,
      }));
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);

    // --- Web Speech recognition --- //
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;

    let recognition: SpeechRecognitionLike | null = null;
    let stopped = false;

    if (!Ctor) {
      setStatus((s) => ({
        ...s,
        supported: false,
        error:
          "Web Speech API not available in this browser. Use Chrome/Edge, or the simulation mode.",
      }));
    } else {
      recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

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
            const ts_start = segStartRef.current || ts_end - text.split(" ").length / 2.5;
            const speaker: Speaker =
              energyRef.current.tab > energyRef.current.mic * 1.15
                ? "candidate"
                : "interviewer";
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
        setStatus((s) => ({ ...s, interim: interim.trim() }));
      };

      recognition.onerror = (e: { error: string }) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        setStatus((s) => ({ ...s, error: e.error }));
      };

      recognition.onend = () => {
        // Auto-restart to keep a continuous session going.
        if (!stopped && recognition) {
          try {
            recognition.start();
          } catch {
            /* ignore double-start */
          }
        }
      };

      try {
        recognition.start();
        setStatus((s) => ({ ...s, listening: true }));
      } catch {
        setStatus((s) => ({ ...s, error: "Could not start speech recognition" }));
      }
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      recognition?.stop();
      ctx.close().catch(() => undefined);
      setStatus((s) => ({ ...s, listening: false }));
    };
  }, [enabled, micStream, displayStream]);

  return { status };
}
