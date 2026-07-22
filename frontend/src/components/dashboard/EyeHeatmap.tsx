"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeatmapCell } from "@/lib/types";
import { Eye } from "lucide-react";

const COLS = 12;
const ROWS = 8;

export function EyeHeatmap({
  cells,
  offScreenPct,
}: {
  cells: HeatmapCell[];
  offScreenPct: number;
}) {
  const lookup = new Map<string, number>();
  for (const c of cells) lookup.set(`${c.x}-${c.y}`, c.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" /> Eye Gaze Heatmap
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {offScreenPct.toFixed(0)}% off-screen
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-md border border-border/60 bg-black/30">
          <div
            className="grid gap-px p-1"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          >
            {Array.from({ length: ROWS * COLS }).map((_, i) => {
              const x = i % COLS;
              const y = Math.floor(i / COLS);
              const v = lookup.get(`${x}-${y}`) ?? 0;
              return (
                <div
                  key={i}
                  className="aspect-square rounded-[2px]"
                  style={{
                    background:
                      v > 0
                        ? `oklch(${0.5 + v * 0.35} ${0.12 + v * 0.12} ${250 - v * 90} / ${0.25 + v * 0.75})`
                        : "oklch(0.3 0.01 265 / 25%)",
                  }}
                />
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded border border-border/50 px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/70">
              Meet candidate view
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Brighter cells = where the candidate looked most. Eye tracking is
          supporting evidence only and never used alone.
        </p>
      </CardContent>
    </Card>
  );
}
