"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { RiskResult } from "@/lib/types";
import { riskBadgeVariant, riskColorVar } from "@/lib/risk";
import { ShieldCheck } from "lucide-react";

function Ring({ score, color }: { score: number; color: string }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="12"
        opacity={0.5}
      />
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.7s ease, stroke 0.4s ease" }}
      />
    </svg>
  );
}

export function RiskGauge({ risk }: { risk: RiskResult }) {
  const color = riskColorVar(risk.risk_level);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground" /> AI-Assistance Risk
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <Ring score={risk.risk_score} color={color} />
          <div className="absolute flex flex-col items-center">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{ color }}
            >
              {Math.round(risk.risk_score)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              risk score
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={riskBadgeVariant(risk.risk_level)} className="text-sm px-3 py-1">
            {risk.risk_level} RISK
          </Badge>
          <Badge variant="muted" className="text-sm px-3 py-1">
            {risk.confidence_level} CONFIDENCE
          </Badge>
        </div>

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Estimate confidence</span>
            <span className="tabular-nums">{Math.round(risk.confidence_score)}%</span>
          </div>
          <Progress
            value={risk.confidence_score}
            indicatorClassName="bg-accent"
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {risk.summary}
        </p>

        <div className="grid w-full grid-cols-2 gap-2 pt-1">
          <div className="glass-subtle rounded-md p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Positive pressure
            </div>
            <div
              className="text-lg font-semibold tabular-nums"
              style={{ color: "var(--positive)" }}
            >
              {risk.positive_pressure.toFixed(2)}
            </div>
          </div>
          <div className="glass-subtle rounded-md p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Human offset
            </div>
            <div
              className="text-lg font-semibold tabular-nums"
              style={{ color: "var(--human)" }}
            >
              -{risk.human_pressure.toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
