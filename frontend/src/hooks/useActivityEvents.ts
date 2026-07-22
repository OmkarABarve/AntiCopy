"use client";

import { useEffect, useRef } from "react";
import type { ActivityEvent, ActivityKind } from "@/lib/types";
import { nowSeconds } from "@/lib/utils";

type Emit = (event: ActivityEvent) => void;

/**
 * Captures browser focus, tab visibility, mouse and keyboard *timestamps only*.
 * We never record key contents - only that activity occurred and when. Mouse and
 * key events are throttled to avoid flooding the socket.
 */
export function useActivityEvents(emit: Emit, enabled: boolean) {
  const lastMouse = useRef(0);
  const lastKey = useRef(0);
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  useEffect(() => {
    if (!enabled) return;

    const fire = (kind: ActivityKind, detail?: string) =>
      emitRef.current({ type: "activity", ts: nowSeconds(), kind, detail });

    const onFocus = () => fire("focus");
    const onBlur = () => fire("blur");
    const onVisibility = () =>
      fire(document.hidden ? "visibility_hidden" : "visibility_visible");

    const onMouse = () => {
      const now = nowSeconds();
      if (now - lastMouse.current > 1.0) {
        lastMouse.current = now;
        fire("mouse");
      }
    };
    const onKey = () => {
      const now = nowSeconds();
      if (now - lastKey.current > 0.4) {
        lastKey.current = now;
        fire("key"); // timestamp only, never the key value
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled]);
}
