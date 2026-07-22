"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MonitorController } from "@/hooks/useMonitorController";
import type { PermissionState } from "@/hooks/useMediaCapture";
import {
  Mic,
  MonitorSmartphone,
  Play,
  Bot,
  User,
  Square,
  ExternalLink,
} from "lucide-react";

function PermChip({
  icon: Icon,
  label,
  state,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  state: PermissionState;
}) {
  const variant =
    state === "granted" ? "positive" : state === "denied" ? "high" : "muted";
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon className="size-3" /> {label}: {state}
    </Badge>
  );
}

export function ControlPanel({ controller }: { controller: MonitorController }) {
  const { mode, capture, face, speech, startLive, startSimulationMode, stop } =
    controller;
  const running = mode !== "idle";
  const meetShared =
    capture.permissions.display === "granted" &&
    (capture.streams.displayStream?.getVideoTracks().length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Console</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PermChip icon={Mic} label="Mic" state={capture.permissions.mic} />
          <PermChip
            icon={MonitorSmartphone}
            label="Meet tab"
            state={capture.permissions.display}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!running && (
            <>
              <Button onClick={() => startLive()}>
                <Play /> Start Live Monitoring
              </Button>
              <Button variant="outline" onClick={() => startSimulationMode("ai_assisted")}>
                <Bot /> Demo: AI-Assisted
              </Button>
              <Button variant="outline" onClick={() => startSimulationMode("human")}>
                <User /> Demo: Human
              </Button>
            </>
          )}
          {running && (
            <Button variant="destructive" onClick={stop}>
              <Square /> Stop
            </Button>
          )}
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noreferrer"
            className="ml-auto"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink /> Open Google Meet
            </Button>
          </a>
        </div>

        {capture.error && mode === "idle" && (
          <p className="text-[11px] font-medium text-[var(--risk-high)]">
            {capture.error}. Live monitoring needs your microphone and a shared
            Google Meet tab (with &quot;Also share tab audio&quot;).
          </p>
        )}

        {mode === "live" && (
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative overflow-hidden rounded-md border border-border/60">
              {/* Preview of Meet tab video feeding MediaPipe (analysis also
                  runs on an internal hidden video). */}
              <video
                ref={face.registerVideo}
                muted
                playsInline
                className="h-24 w-40 bg-black object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                Meet gaze video
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {!meetShared && (
                <div className="font-medium text-[var(--risk-high)]">
                  Meet tab not shared - candidate gaze is disabled. Share the
                  Google Meet tab (with &quot;Also share tab audio&quot;) to
                  enable it.
                </div>
              )}
              <div>
                Candidate gaze (Meet video):{" "}
                {!meetShared || !face.status.hasVideo
                  ? "blocked - share the Meet tab"
                  : face.status.ready
                    ? face.status.faceVisible
                      ? face.status.lastGaze && face.status.lastGaze.gaze_y > 0.35
                        ? "tracking · looking down"
                        : "tracking candidate face"
                      : "no face detected - pin/spotlight the candidate"
                    : face.status.loading
                      ? "loading model…"
                      : face.status.error ?? "idle"}
              </div>
              <div>
                Speech:{" "}
                {speech.status.supported
                  ? speech.status.listening
                    ? "listening"
                    : "starting…"
                  : "not supported (use Chrome/Edge or Demo mode)"}
              </div>
              <div>
                Tip: pin or spotlight the candidate in Meet so their face is the
                largest tile, and enable &quot;Also share tab audio&quot; for
                candidate transcription. Gaze uses the Meet tab, not your webcam.
              </div>
            </div>
          </div>
        )}

        {mode === "simulation" && (
          <p className="text-[11px] text-muted-foreground">
            Running a deterministic replay of a scripted interview. All analytics
            below are computed by the real backend engine from simulated events.
            No Meet tab or camera required.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
