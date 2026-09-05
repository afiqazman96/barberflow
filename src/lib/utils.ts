import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "MYR") {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** Today's local date as `YYYY-MM-DD` — matches the shape booking/queue dates use. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Compact relative age, e.g. "just now", "12m", "2h 05m". */
export function elapsedSince(from: string | Date): string {
  const start = typeof from === "string" ? new Date(from) : from;
  const mins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
