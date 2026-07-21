"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check } from "lucide-react";

interface Props {
  title: string;
  signals: Signal[];
  kind: "positive" | "human";
}

export function SignalList({ title, signals, kind }: Props) {
  const color = kind === "positive" ? "var(--positive)" : "var(--human)";
  const Icon = kind === "positive" ? AlertTriangle : Check;
  const empty =
    kind === "positive"
      ? "No risk-raising signals detected yet."
      : "No human-like signals detected yet.";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" style={{ color }} />
          {title}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {signals.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.length === 0 && (
          <p className="text-xs text-muted-foreground">{empty}</p>
        )}
        {signals.map((s) => (
          <div
            key={s.id}
            className="rounded-md border border-border/60 bg-muted/20 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Check className="size-3.5 shrink-0" style={{ color }} />
                {s.label}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {Math.round(s.confidence * 100)}%
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {s.explanation}
            </p>
            <Progress
              value={s.confidence * 100}
              className={cn("mt-2 h-1")}
              indicatorClassName={kind === "positive" ? "" : "bg-[var(--human)]"}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
