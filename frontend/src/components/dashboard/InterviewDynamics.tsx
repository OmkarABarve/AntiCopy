"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeatureSnapshot, QuestionType } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";
import { GitCompareArrows } from "lucide-react";

export function InterviewDynamics({ features }: { features: FeatureSnapshot }) {
  const rows = Object.entries(features.by_question_type).filter(
    ([k]) => k !== "untagged",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-muted-foreground" /> Interview
          Dynamics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Tag question types to compare behaviour across difficulty. Flat
            latency/WPM across easy vs hard questions is a subtle positive signal.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border/50">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Question type</th>
                  <th className="px-3 py-2 text-right font-medium">Latency</th>
                  <th className="px-3 py-2 text-right font-medium">WPM</th>
                  <th className="px-3 py-2 text-right font-medium">Words</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([qt, m]) => (
                  <tr key={qt} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      {QUESTION_TYPE_LABELS[qt as QuestionType] ?? qt}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.avg_latency?.toFixed(1)}s
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(m.avg_wpm ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {Math.round(m.avg_words ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
