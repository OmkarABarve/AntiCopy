"use client";

import type { MonitorState } from "@/lib/types";
import type { ConnectionStatus } from "@/hooks/useMonitorSocket";
import { LiveStatus } from "./LiveStatus";
import { RiskGauge } from "./RiskGauge";
import { SignalList } from "./SignalList";
import { SuggestedFlow } from "./SuggestedFlow";
import { OwnershipScore } from "./OwnershipScore";
import { EyeHeatmap } from "./EyeHeatmap";
import { LiveTranscript } from "./LiveTranscript";
import { InterviewDynamics } from "./InterviewDynamics";
import {
  BlinkTimeline,
  ConversationTimeline,
  LatencyTimeline,
  PauseTimeline,
  WpmTimeline,
} from "./Charts";
import { Card, CardContent } from "@/components/ui/card";

export function MonitorDashboard({
  state,
  connection,
  modeLabel,
  interim,
}: {
  state: MonitorState | null;
  connection: ConnectionStatus;
  modeLabel: string;
  interim?: string;
}) {
  return (
    <div className="space-y-4">
      <LiveStatus state={state} connection={connection} modeLabel={modeLabel} />

      {!state ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Waiting for the monitoring session to start…
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left rail: risk + ownership */}
          <div className="space-y-4 lg:col-span-4 xl:col-span-3">
            <RiskGauge risk={state.risk} />
            <OwnershipScore score={state.ownership_score} features={state.features} />
          </div>

          {/* Center: suggestions, signals, charts */}
          <div className="space-y-4 lg:col-span-8 xl:col-span-6">
            <SuggestedFlow flow={state.flow} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SignalList
                title="Evidence"
                signals={state.risk.evidence}
                kind="positive"
              />
              <SignalList
                title="Counter-Evidence"
                signals={state.risk.counter_evidence}
                kind="human"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WpmTimeline data={state.timelines.wpm} />
              <LatencyTimeline data={state.timelines.latency} />
              <BlinkTimeline data={state.timelines.blink} />
              <PauseTimeline data={state.timelines.pause} />
            </div>
            <ConversationTimeline data={state.timelines.conversation} />
            <InterviewDynamics features={state.features} />
          </div>

          {/* Right rail: transcript + heatmap */}
          <div className="space-y-4 lg:col-span-12 xl:col-span-3">
            <div className="h-[520px]">
              <LiveTranscript transcript={state.transcript} interim={interim} />
            </div>
            <EyeHeatmap
              cells={state.heatmap}
              offScreenPct={state.features.values.gaze_off_screen_pct ?? 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
