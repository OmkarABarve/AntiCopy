"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export function LiveTranscript({
  transcript,
  interim,
}: {
  transcript: TranscriptSegment[];
  interim?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Only keep pinned to bottom if the user is already near the bottom.
    // Never use scrollIntoView — it scrolls the whole page.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 96) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript.length, interim]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" /> Live Transcript
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={containerRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto pr-3"
      >
        {transcript.length === 0 && !interim && (
          <p className="text-xs text-muted-foreground">
            Transcript will appear as the conversation is detected...
          </p>
        )}
        {transcript.map((seg, i) => {
          const isCandidate = seg.speaker === "candidate";
          return (
            <div
              key={i}
              className={cn("flex flex-col", isCandidate ? "items-start" : "items-end")}
            >
              <span className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {isCandidate ? "Candidate" : "Interviewer"}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                  isCandidate
                    ? "bg-accent/15 text-foreground"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {seg.text}
              </div>
            </div>
          );
        })}
        {interim && (
          <div className="flex flex-col items-start opacity-60">
            <span className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              …
            </span>
            <div className="max-w-[85%] rounded-lg bg-muted/20 px-3 py-2 text-xs italic">
              {interim}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
