"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FeatureSnapshot } from "@/lib/types";
import { Fingerprint } from "lucide-react";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "ownership_implementation", label: "Implementation" },
  { key: "ownership_debugging", label: "Debugging" },
  { key: "ownership_design", label: "Design decisions" },
  { key: "ownership_tradeoffs", label: "Tradeoffs" },
  { key: "ownership_lessons", label: "Lessons learned" },
  { key: "ownership_personal", label: "Personal experience" },
];

export function OwnershipScore({
  score,
  features,
}: {
  score: number;
  features: FeatureSnapshot;
}) {
  const v = features.values;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-4 text-muted-foreground" /> Ownership Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold tabular-nums text-[var(--human)]">
            {Math.round(score)}
          </span>
          <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
        </div>
        <Progress value={score} indicatorClassName="bg-[var(--human)]" />
        <p className="text-[11px] text-muted-foreground">
          First-hand reasoning about real work strongly lowers risk. Higher is
          more human-like.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {CATEGORIES.map((c) => {
            const hits = v[c.key] ?? 0;
            const active = hits > 0;
            return (
              <div
                key={c.key}
                className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
              >
                <span
                  className={
                    active ? "text-xs text-foreground" : "text-xs text-muted-foreground/60"
                  }
                >
                  {c.label}
                </span>
                <span
                  className="size-2 rounded-full"
                  style={{
                    background: active ? "var(--human)" : "var(--muted)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
