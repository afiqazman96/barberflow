"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ToggleLeft } from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlatformStore } from "@/lib/store/platform-store";
import { FEATURE_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function planVariant(name: string): "gold" | "info" | "default" {
  if (name === "Enterprise") return "gold";
  if (name === "Growth") return "info";
  return "default";
}

function FeatureSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        enabled
          ? "bg-[var(--gold)]"
          : "border border-[var(--border)] bg-[var(--bg-muted)]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export default function SuperAdminFeaturesPage() {
  const packages = usePlatformStore((s) => s.packages);
  const featureMatrix = usePlatformStore((s) => s.featureMatrix);
  const toggleFeature = usePlatformStore((s) => s.toggleFeature);

  const enabledCounts = useMemo(
    () =>
      packages.map((pkg) => {
        const row = featureMatrix[pkg.id] ?? {};
        const count = FEATURE_KEYS.filter(({ key }) => row[key]).length;
        return { pkg, count };
      }),
    [packages, featureMatrix],
  );

  function handleToggle(packageId: string, feature: (typeof FEATURE_KEYS)[number]["key"]) {
    toggleFeature(packageId, feature);
    const pkg = packages.find((p) => p.id === packageId);
    const label = FEATURE_KEYS.find((f) => f.key === feature)?.label ?? feature;
    toast.success("Feature updated", {
      description: `${label} · ${pkg?.name ?? "Package"}`,
    });
  }

  return (
    <>
      <Topbar
        title="Feature Management"
        actions={
          <span className="text-xs text-[var(--text-faint)]">
            Changes save instantly
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {enabledCounts.map((item, i) => (
              <motion.div
                key={item.pkg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">
                    {item.pkg.name}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {item.count}/{FEATURE_KEYS.length}
                  </p>
                  <Badge variant={planVariant(item.pkg.name)} className="mt-2">
                    features enabled
                  </Badge>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ToggleLeft className="h-5 w-5 text-[var(--gold)]" />
                Feature Flags Matrix
              </CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-4 pr-6 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">
                      Feature
                    </th>
                    {packages.map((pkg) => (
                      <th
                        key={pkg.id}
                        className="px-4 pb-4 text-center text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]"
                      >
                        <Badge variant={planVariant(pkg.name)}>{pkg.name}</Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_KEYS.map(({ key, label }, i) => (
                    <motion.tr
                      key={key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.03 }}
                      className="border-b border-[var(--border)]/50 last:border-0"
                    >
                      <td className="py-4 pr-6 font-medium">{label}</td>
                      {packages.map((pkg) => {
                        const enabled = featureMatrix[pkg.id]?.[key] ?? false;
                        return (
                          <td key={pkg.id} className="px-4 py-4 text-center">
                            <div className="flex justify-center">
                              <FeatureSwitch
                                enabled={enabled}
                                onChange={() => handleToggle(pkg.id, key)}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageTransition>
    </>
  );
}
