import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none transition focus:border-[var(--gold-dim)] focus:ring-2 focus:ring-[var(--gold)]/20",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-xs font-medium text-[var(--text-muted)]", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none transition focus:border-[var(--gold-dim)] focus:ring-2 focus:ring-[var(--gold)]/20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold-dim)] focus:ring-2 focus:ring-[var(--gold)]/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
