"use client";

import { useSyncExternalStore } from "react";

let current: Date | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  current = new Date();
  if (!timer) {
    timer = setInterval(() => {
      current = new Date();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * The current time, refreshed every 30s. `null` on the server and during
 * hydration so time-dependent text never mismatches — render a placeholder
 * until it's set.
 */
export function useNow(): Date | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
