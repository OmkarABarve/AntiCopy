"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimelinePoint } from "@/lib/types";
import { CHART_COLORS } from "@/lib/risk";

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 10,
};

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          {hint && (
            <span className="text-[10px] font-normal text-muted-foreground">
              {hint}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[170px] px-2">{children}</CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Waiting for data...
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "oklch(0.2 0.02 265)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 11,
  },
  labelStyle: { color: "var(--muted-foreground)" },
};

export function WpmTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartCard title="WPM Timeline" hint="words per minute per answer">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="wpmFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" unit="s" {...AXIS} tickLine={false} />
            <YAxis {...AXIS} tickLine={false} width={38} />
            <Tooltip {...tooltipStyle} />
            <Area
              type="monotone"
              dataKey="value"
              name="WPM"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill="url(#wpmFill)"
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function LatencyTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartCard title="Response Latency" hint="seconds to start answering">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" unit="s" {...AXIS} tickLine={false} />
            <YAxis {...AXIS} tickLine={false} width={38} unit="s" />
            <Tooltip {...tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              name="Latency"
              stroke={CHART_COLORS.accent}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function BlinkTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartCard title="Blink Timeline" hint="blinks per 10s window">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" unit="s" {...AXIS} tickLine={false} />
            <YAxis {...AXIS} tickLine={false} width={38} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Blinks" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function PauseTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartCard title="Pause Timeline" hint="silent gap length (s)">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" unit="s" {...AXIS} tickLine={false} />
            <YAxis {...AXIS} tickLine={false} width={38} unit="s" />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" name="Pause" fill={CHART_COLORS.warn} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ConversationTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartCard title="Conversation Timeline" hint="candidate (up) vs interviewer (down)">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" unit="s" {...AXIS} tickLine={false} />
            <YAxis {...AXIS} tickLine={false} width={38} unit="s" />
            <Tooltip {...tooltipStyle} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grid} />
            <Bar dataKey="value" name="Turn (s)" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.value >= 0 ? CHART_COLORS.candidate : CHART_COLORS.interviewer}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
