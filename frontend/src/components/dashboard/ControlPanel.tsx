"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MonitorController } from "@/hooks/useMonitorController";
import type { PermissionState } from "@/hooks/useMediaCapture";
import {
  Camera,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Console</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PermChip icon={Mic} label="Mic" state={capture.permissions.mic} />
          <PermChip icon={Camera} label="Camera" state={capture.permissions.camera} />
          <PermChip
            icon={MonitorSmartphone}
            label="Screen"
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

        {mode === "live" && (
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative overflow-hidden rounded-md border border-border/60">
              {/* Hidden-ish camera preview feeding MediaPipe */}
              <video
                ref={face.videoRef}
                muted
                playsInline
                className="h-24 w-32 -scale-x-100 object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                gaze input
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div>
                Face model:{" "}
                {face.status.ready
                  ? face.status.faceVisible
                    ? "tracking face"
                    : "no face detected"
                  : face.status.loading
                    ? "loading…"
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
                To transcribe candidate audio, share the Google Meet tab with
                &quot;Also share tab audio&quot; enabled.
              </div>
            </div>
          </div>
        )}

        {mode === "simulation" && (
          <p className="text-[11px] text-muted-foreground">
            Running a deterministic replay of a scripted interview. All analytics
            below are computed by the real backend engine from simulated events.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
