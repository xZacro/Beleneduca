import { useEffect, useRef } from "react";

import { getUser, heartbeatSession } from "./auth";

export function useHeartbeat(intervalMs = 60_000) {
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (!getUser()) return;
      if (pendingRef.current) return;

      pendingRef.current = true;

      try {
        await heartbeatSession();
      } finally {
        pendingRef.current = false;
      }
    };

    const start = () => {
      if (timerRef.current) return;
      void tick();
      timerRef.current = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void tick();
      }, intervalMs);
    };

    const stop = () => {
      if (!timerRef.current) return;
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    };

    if (getUser()) start();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && getUser()) start();
    };

    window.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
