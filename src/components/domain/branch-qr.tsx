"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBranchJoinUrl } from "@/lib/store/app-store";
import type { Branch } from "@/lib/types";

export function BranchQrPanel({
  branch,
  size = 180,
  compact = false,
}: {
  branch: Branch;
  size?: number;
  compact?: boolean;
}) {
  const [origin, setOrigin] = useState("https://barberflow.app");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = getBranchJoinUrl(branch.id, origin);

  function copyLink() {
    void navigator.clipboard?.writeText(url);
    toast.success("QR link copied", { description: url });
  }

  function downloadSvg() {
    const svg = document.getElementById(`qr-${branch.id}`);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${branch.name.replace(/\s+/g, "-").toLowerCase()}-walkin-qr.svg`;
    a.click();
    URL.revokeObjectURL(href);
    toast.success("QR downloaded");
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white p-2">
          <QRCodeSVG
            id={`qr-${branch.id}`}
            value={url}
            size={72}
            bgColor="#ffffff"
            fgColor="#0c0b09"
            level="M"
            includeMargin={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--gold-soft)]">Walk-in QR</p>
          <p className="truncate text-[10px] text-[var(--text-faint)]">{url}</p>
          <div className="mt-1.5 flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyLink}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4">
        <p className="flex items-center gap-2 font-display text-base font-semibold">
          <QrCode className="h-4 w-4 text-[var(--gold)]" />
          Walk-in QR · {branch.name}
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Print &amp; place at the counter. Customers scan to join this branch queue.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
          <QRCodeSVG
            id={`qr-${branch.id}`}
            value={url}
            size={size}
            bgColor="#ffffff"
            fgColor="#0c0b09"
            level="M"
            includeMargin
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-xl bg-[var(--bg-muted)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              Deep link
            </p>
            <p className="break-all text-xs text-[var(--text-muted)]">{url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadSvg}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open join page
              </a>
            </Button>
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            Staff can also register walk-ins manually from Cashier → Queue.
          </p>
        </div>
      </div>
    </Card>
  );
}
