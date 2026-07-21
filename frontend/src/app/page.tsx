"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { MonitorDashboard } from "@/components/dashboard/MonitorDashboard";
import { QuestionTagger } from "@/components/dashboard/QuestionTagger";
import { Button } from "@/components/ui/button";
import { useMonitorController } from "@/hooks/useMonitorController";
import { ExternalLink } from "lucide-react";

const MODE_LABELS: Record<string, string> = {
  idle: "standby",
  live: "live capture",
  simulation: "simulation replay",
};

export default function Home() {
  const controller = useMonitorController();
  const { mode, connection, state, tagQuestion, sessionId, speech } = controller;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      <div className="flex items-start justify-between">
        <AppHeader />
        <Link href={`/dashboard?session=${sessionId}`} target="_blank">
          <Button variant="outline" size="sm">
            <ExternalLink /> Open reviewer dashboard
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ControlPanel controller={controller} />
          </div>
          <QuestionTagger onTag={tagQuestion} disabled={mode !== "live"} />
        </div>

        <MonitorDashboard
          state={state}
          connection={connection}
          modeLabel={MODE_LABELS[mode] ?? mode}
          interim={mode === "live" ? speech.status.interim : undefined}
        />
      </div>

      <footer className="mt-10 border-t border-border/50 pt-4 text-center text-[11px] text-muted-foreground">
        Sentinel estimates probability from behaviour; it never accuses and is not
        proof of misconduct. Designed to minimise false positives - every
        suspicious signal can be offset by human-like evidence.
      </footer>
    </main>
  );
}
