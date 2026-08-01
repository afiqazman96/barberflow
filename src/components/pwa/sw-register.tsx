"use client";

import { useEffect } from "react";

/**
 * Always cleans up service workers in development.
 * Production registration is disabled until a Next-safe PWA SW is added —
 * the previous cache-all SW caused infinite refresh loops.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function cleanup() {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // ignore
      }
    }

    void cleanup();
  }, []);

  return null;
}
