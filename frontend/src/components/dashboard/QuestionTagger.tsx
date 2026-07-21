"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuestionType } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";
import { Tag } from "lucide-react";

const ORDER: QuestionType[] = [
  "easy",
  "hard_technical",
  "rapid_easy",
  "opinion",
  "resume_ownership",
  "personal_experience",
  "constraint",
  "follow_up",
];

export function QuestionTagger({
  onTag,
  disabled,
}: {
  onTag: (qt: QuestionType) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-4 text-muted-foreground" /> Tag Current Question
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Tag the question type as you ask it. This powers interview-dynamics
          comparison (latency/WPM across difficulty).
        </p>
        <div className="flex flex-wrap gap-2">
          {ORDER.map((qt) => (
            <Button
              key={qt}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onTag(qt)}
            >
              {QUESTION_TYPE_LABELS[qt]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
