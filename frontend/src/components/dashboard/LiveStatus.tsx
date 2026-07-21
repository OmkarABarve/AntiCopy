"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MonitorState } from "@/lib/types";
import type { ConnectionStatus } from "@/hooks/useMonitorSocket";
import { formatDuration } from "@/lib/utils";
import { Activity, Radio, Wifi, WifiOff } from "lucide-react";

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

export function LiveStatus({
  state,
  connection,
  modeLabel,
}: {
  state: MonitorState | null;
  connection: ConnectionStatus;
  modeLabel: string;
}) {
  const v = state?.features.values ?? {};
  const monitoring = state?.status === "monitoring";
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
        <div className="flex items-center gap-2">
          <span
            className={`live-dot inline-block size-2.5 rounded-full ${
              monitoring ? "bg-[var(--risk-low)]" : "bg-muted-foreground"
            }`}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {monitoring ? "Monitoring live" : state?.status === "stopped" ? "Stopped" : "Idle"}
            </span>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Radio className="size-3" /> {modeLabel}
            </span>
          </div>
        </div>

        <Stat label="Duration" value={formatDuration(state?.duration_s ?? 0)} />
        <Stat label="Speaking ratio" value={Math.round((v.speaking_ratio ?? 0) * 100)} unit="%" />
        <Stat label="Overall WPM" value={Math.round(v.wpm_overall ?? 0)} />
        <Stat label="Avg latency" value={(v.response_latency_mean ?? 0).toFixed(1)} unit="s" />
        <Stat label="Off-screen" value={Math.round(v.gaze_off_screen_pct ?? 0)} unit="%" />
        <Stat
          label="Data collected"
          value={Math.round((state?.data_sufficiency ?? 0) * 100)}
          unit="%"
        />

        <div className="ml-auto flex items-center gap-2">
          <Badge variant={connection === "connected" ? "positive" : "muted"}>
            {connection === "connected" ? (
              <Wifi className="size-3" />
            ) : (
              <WifiOff className="size-3" />
            )}
            {connection}
          </Badge>
          <Badge variant="muted">
            <Activity className="size-3" /> {state?.session_id ?? "—"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
