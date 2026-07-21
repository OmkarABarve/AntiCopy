"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MonitorDashboard } from "@/components/dashboard/MonitorDashboard";
import { useMonitorSocket } from "@/hooks/useMonitorSocket";

function ReviewerView() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "live";
  const { status, state } = useMonitorSocket({ sessionId, enabled: true });

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      <AppHeader subtitle={`Read-only reviewer view · session ${sessionId}`} />
      <MonitorDashboard
        state={state}
        connection={status}
        modeLabel="reviewer (read-only)"
      />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Loading reviewer dashboard…
        </div>
      }
    >
      <ReviewerView />
    </Suspense>
  );
}
