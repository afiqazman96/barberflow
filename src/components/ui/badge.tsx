import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)]",
        gold: "bg-[var(--gold)]/15 text-[var(--gold-soft)] border border-[var(--gold)]/25",
        success: "bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/25",
        warning: "bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/25",
        danger: "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/25",
        info: "bg-[var(--info)]/15 text-[var(--info)] border border-[var(--info)]/25",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: VariantProps<typeof badgeVariants>["variant"] }> = {
    "off-duty": { label: "Off Duty", variant: "default" },
    available: { label: "Available", variant: "success" },
    busy: { label: "Busy", variant: "warning" },
    break: { label: "Break", variant: "info" },
    waiting: { label: "Waiting", variant: "warning" },
    called: { label: "Called", variant: "info" },
    "in-service": { label: "In Service", variant: "gold" },
    "awaiting-payment": { label: "Awaiting Pay", variant: "warning" },
    completed: { label: "Completed", variant: "success" },
    "no-show": { label: "No Show", variant: "danger" },
    cancelled: { label: "Cancelled", variant: "default" },
    confirmed: { label: "Confirmed", variant: "info" },
    "checked-in": { label: "Checked In", variant: "gold" },
    open: { label: "Open", variant: "success" },
    closed: { label: "Closed", variant: "default" },
    active: { label: "Active", variant: "success" },
    trial: { label: "Trial", variant: "info" },
    suspended: { label: "Suspended", variant: "danger" },
    "in-progress": { label: "In Progress", variant: "warning" },
    resolved: { label: "Resolved", variant: "success" },
    high: { label: "High", variant: "danger" },
    medium: { label: "Medium", variant: "warning" },
    low: { label: "Low", variant: "default" },
    none: { label: "Walk-in", variant: "default" },
    silver: { label: "Silver", variant: "default" },
    gold: { label: "Gold", variant: "gold" },
    platinum: { label: "Platinum", variant: "info" },
  };
  const cfg = map[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
