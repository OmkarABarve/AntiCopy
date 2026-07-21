import type { ConfidenceLevel, RiskLevel } from "@/lib/types";

export function riskColorVar(level: RiskLevel): string {
  return {
    LOW: "var(--risk-low)",
    MEDIUM: "var(--risk-medium)",
    HIGH: "var(--risk-high)",
  }[level];
}

export function riskBadgeVariant(level: RiskLevel): "low" | "medium" | "high" {
  return level.toLowerCase() as "low" | "medium" | "high";
}

export function confidenceLabel(level: ConfidenceLevel): string {
  return `${level.charAt(0)}${level.slice(1).toLowerCase()} confidence`;
}

export const CHART_COLORS = {
  primary: "oklch(0.75 0.15 250)",
  accent: "oklch(0.78 0.14 190)",
  candidate: "oklch(0.78 0.14 190)",
  interviewer: "oklch(0.72 0.12 300)",
  warn: "oklch(0.82 0.16 85)",
  grid: "oklch(0.4 0.02 265 / 35%)",
};
