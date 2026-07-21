"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/config";
import type { InboundEvent, MonitorState, OutboundMessage } from "@/lib/types";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface UseMonitorSocketOptions {
  sessionId: string;
  enabled: boolean;
  onState?: (state: MonitorState) => void;
}

/**
 * Typed WebSocket client with auto-reconnect and outbound batching. Sends
 * InboundEvents to the backend and surfaces the latest MonitorState.
 */
export function useMonitorSocket({
  sessionId,
  enabled,
  onState,
}: UseMonitorSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [state, setState] = useState<MonitorState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<InboundEvent[]>([]);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  const flush = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const queue = queueRef.current;
    if (queue.length === 0) return;
    for (const ev of queue) {
      try {
        ws.send(JSON.stringify(ev));
      } catch {
        // drop on error; next flush will retry newer events
      }
    }
    queueRef.current = [];
  }, []);

  const send = useCallback(
    (event: InboundEvent) => {
      queueRef.current.push(event);
      // Control events are latency-sensitive: flush immediately.
      if (event.type === "control") flush();
    },
    [flush],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      const ws = new WebSocket(wsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        flush();
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as OutboundMessage;
          if (msg.type === "state") {
            setState(msg);
            onStateRef.current?.(msg);
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        setStatus("disconnected");
        if (!cancelled) {
          reconnectRef.current = setTimeout(connect, 1200);
        }
      };
    };

    connect();
    flushRef.current = setInterval(flush, 250);

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (flushRef.current) clearInterval(flushRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, sessionId, flush]);

  return { status, state, send };
}
