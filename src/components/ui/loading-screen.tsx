"use client";

import { motion } from "framer-motion";
import { Scissors } from "lucide-react";

/**
 * Barber-themed route loading state — an animated pair of scissors "snipping"
 * with falling clippings. Used by the App Router `loading.tsx` files so slow,
 * server-rendered portal pages show something on-brand instead of a frozen
 * screen.
 */
export function LoadingScreen({
  label = "Getting things ready…",
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={
        fullscreen
          ? "app-bg flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-8"
          : "flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 p-8"
      }
    >
      <div className="relative">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-full h-3 w-[3px] rounded-full bg-[var(--gold-dim)]/60"
            style={{ marginLeft: (i - 1) * 9 }}
            initial={{ y: -8, opacity: 0, rotate: 0 }}
            animate={{ y: 30, opacity: [0, 1, 0], rotate: 100 }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.35,
              ease: "easeIn",
            }}
          />
        ))}

        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient text-[var(--on-gold)] shadow-[var(--shadow)]"
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            animate={{ rotate: [0, -20, 3, -20, 0] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.25, 0.5, 0.75, 1],
            }}
          >
            <Scissors className="h-8 w-8" />
          </motion.div>
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <p className="font-display text-sm font-semibold tracking-tight text-[var(--text)]">
          {label}
        </p>
        <div className="relative h-1 w-32 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-[var(--gold)]"
            animate={{ x: ["-120%", "360%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}
