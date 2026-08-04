"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LucideIcon,
  Scissors,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function useMobileNav() {
  return useContext(MobileNavContext);
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: { href: string; label: string; icon: LucideIcon }[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== items[0]?.href && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-[var(--gold)]/10 text-[var(--gold-soft)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]",
            )}
          >
            <Icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl gold-gradient text-[#0c0b09]">
        <Scissors className="h-5 w-5" />
      </div>
      <div>
        <p className="font-display text-sm font-bold tracking-tight">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-faint)]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SidebarFooter({
  footerHref,
  footerLabel,
  onNavigate,
}: {
  footerHref: string;
  footerLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-[var(--border)] p-3">
      <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)]">
        <Bell className="h-4 w-4" />
        Notifications
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--gold)]/20 px-1.5 text-xs text-[var(--gold-soft)]">
          3
        </span>
      </div>
      <Button asChild variant="ghost" className="w-full justify-start" size="sm">
        <Link href={footerHref} onClick={onNavigate}>
          <LogOut className="h-4 w-4" />
          {footerLabel}
        </Link>
      </Button>
    </div>
  );
}

export function Sidebar({
  title,
  subtitle,
  items,
  footerHref = "/",
  footerLabel = "Sign out",
}: {
  title: string;
  subtitle?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
  footerHref?: string;
  footerLabel?: string;
}) {
  const mobileNav = useMobileNav();
  const setOpen = mobileNav?.setOpen;
  const open = mobileNav?.open ?? false;
  const pathname = usePathname();
  const close = useCallback(() => setOpen?.(false), [setOpen]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] lg:flex">
        <SidebarBrand title={title} subtitle={subtitle} />
        <NavLinks items={items} />
        <SidebarFooter footerHref={footerHref} footerLabel={footerLabel} />
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.aside
              className="safe-top absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <div className="relative pr-12">
                <SidebarBrand title={title} subtitle={subtitle} />
                <button
                  type="button"
                  onClick={close}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks items={items} onNavigate={close} />
              <SidebarFooter
                footerHref={footerHref}
                footerLabel={footerLabel}
                onNavigate={close}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  const mobileNav = useMobileNav();

  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {mobileNav && (
          <button
            type="button"
            onClick={() => mobileNav.setOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text)] transition hover:border-[var(--gold-dim)] hover:text-[var(--gold-soft)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="font-display truncate text-lg font-semibold tracking-tight md:text-xl">
          {title}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AppShell({
  sidebar,
  bottomNav,
  children,
}: {
  sidebar: React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(
    () => ({ open, setOpen, toggle }),
    [open, toggle],
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={value}>
      <div className="app-bg flex min-h-dvh">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={cn("flex-1 overflow-y-auto", bottomNav && "pb-24 lg:pb-6")}
          >
            {children}
          </main>
          {bottomNav}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
