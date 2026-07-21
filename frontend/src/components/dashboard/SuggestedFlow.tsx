"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FlowSuggestion } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";
import { Compass, Lightbulb, ArrowRight } from "lucide-react";

export function SuggestedFlow({ flow }: { flow: FlowSuggestion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-[var(--risk-medium)]" /> Suggested Next
          Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Badge>{QUESTION_TYPE_LABELS[flow.next_question_type]}</Badge>
          </div>
          <p className="text-sm font-medium text-foreground">
            {flow.next_question_prompt}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {flow.rationale}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Compass className="size-3.5" /> Suggested adaptive flow
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {flow.adaptive_flow.map((qt, i) => (
              <div key={qt} className="flex items-center gap-1.5">
                <Badge variant={i === 0 ? "default" : "muted"}>
                  {QUESTION_TYPE_LABELS[qt]}
                </Badge>
                {i < flow.adaptive_flow.length - 1 && (
                  <ArrowRight className="size-3 text-muted-foreground/60" />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
