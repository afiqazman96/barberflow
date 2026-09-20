"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Crown,
  Check,
  History,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MEMBERSHIP_PLANS } from "@/lib/mock/data";
import type { Customer, MembershipPlan } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const STORAGE_KEY = "barberflow-guest-profile";

type StoredMembership = Customer["membership"];

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [membership, setMembership] = useState<StoredMembership>("none");
  const [saved, setSaved] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<MembershipPlan | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          name: string;
          phone: string;
          membership?: StoredMembership;
        };
        setName(data.name);
        setPhone(data.phone);
        setMembership(data.membership ?? "none");
      }
    } catch {
      // No saved profile on this device — start as a blank guest.
    }
  }, []);

  function persist(patch: Partial<{ name: string; phone: string; membership: StoredMembership }>) {
    const next = { name, phone, membership, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    persist({ name, phone });
    setSaved(true);
    toast.success("Profile saved");
    setTimeout(() => setSaved(false), 2000);
  }

  function handleConfirmUpgrade() {
    if (!pendingPlan) return;
    setActivating(true);
    setTimeout(() => {
      setMembership(pendingPlan.tier);
      persist({ membership: pendingPlan.tier });
      toast.success(`Welcome to ${pendingPlan.name}!`, {
        description: "Member pricing applies from your next visit",
      });
      setActivating(false);
      setPendingPlan(null);
    }, 600);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Guest account · no sign-up required
        </p>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold)]/20 font-display text-xl font-bold text-[var(--gold-soft)]">
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-display text-lg font-semibold">{name || "Guest"}</p>
            <StatusBadge status={membership} />

          </div>
        </div>
      </Card>

      <form onSubmit={handleSave} className="space-y-4">
        <Card className="p-4">
          <CardHeader className="mb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--gold)]" />
                Your Details
              </CardTitle>
              <CardDescription>
                Saved locally on this device
              </CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="mt-4 w-full" variant={saved ? "success" : "default"}>
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </Card>
      </form>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Crown className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Membership Plans
          </h2>
        </div>
        <div className="space-y-3">
          {MEMBERSHIP_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card
                className={cn(
                  "p-4",
                  plan.tier === "gold" && "border-[var(--gold)]/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold">{plan.name}</h3>
                      {plan.tier === "gold" && (
                        <Badge variant="gold">
                          <Sparkles className="h-3 w-3" /> Popular
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {plan.discountPercent}% off · {plan.members} members
                    </p>
                  </div>
                  <p className="font-display text-lg font-bold text-[var(--gold-soft)]">
                    {formatCurrency(plan.price)}
                    <span className="text-xs font-normal text-[var(--text-faint)]">
                      /mo
                    </span>
                  </p>
                </div>
                <ul className="mt-3 space-y-1">
                  {plan.benefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 text-xs text-[var(--text-muted)]"
                    >
                      <Check className="h-3 w-3 shrink-0 text-[var(--success)]" />
                      {b}
                    </li>
                  ))}
                </ul>
                {membership === plan.tier ? (
                  <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                    <Check className="h-4 w-4" /> Your current plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.tier === "gold" ? "default" : "outline"}
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => setPendingPlan(plan)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Recent Visits
          </h2>
        </div>
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          Your visit history will show here once you can sign in with your
          phone number. Until then, ask at the front desk for past receipts.
        </Card>
      </section>

      <Card className="flex items-center gap-3 p-4 text-sm text-[var(--text-muted)]">
        <Phone className="h-5 w-5 shrink-0 text-[var(--gold)]" />
        Need help? Call your branch or ask at the front desk.
      </Card>

      <Modal
        open={!!pendingPlan}
        onOpenChange={(open) => !open && setPendingPlan(null)}
        title={pendingPlan ? `Activate ${pendingPlan.name}` : ""}
        description={
          pendingPlan
            ? `${formatCurrency(pendingPlan.price)}/mo · ${pendingPlan.discountPercent}% off every visit`
            : ""
        }
      >
        {pendingPlan && (
          <div className="space-y-4">
            <ul className="space-y-1.5">
              {pendingPlan.benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-faint)]">
              Demo checkout — no card is charged. Your membership status is
              saved on this device and applies from your next visit.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmUpgrade}
              disabled={activating}
            >
              {activating
                ? "Activating…"
                : `Confirm & Activate · ${formatCurrency(pendingPlan.price)}/mo`}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
