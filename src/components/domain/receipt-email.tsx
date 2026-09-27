"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendReceiptEmail } from "@/lib/email/receipt-client";
import type { Sale } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Email receipt" for a finished sale. With an address on file it is one
 * button; without one it asks for the address first, so a customer who didn't
 * give an email at the door can still get their receipt.
 */
export function ReceiptEmailControl({
  sale,
  className,
  label = "Email receipt",
}: {
  sale: Sale;
  className?: string;
  label?: string;
}) {
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);

  const onFile = sale.customerEmail?.trim();
  const target = onFile || typed.trim();
  const canSend = EMAIL_RE.test(target) && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    await sendReceiptEmail(sale, target);
    setSending(false);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {!onFile && (
        <Input
          type="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="customer@email.com"
          aria-label="Customer email"
          className="min-w-0 flex-1"
        />
      )}
      <Button
        variant="secondary"
        className={onFile ? "flex-1" : undefined}
        disabled={!canSend}
        onClick={() => void send()}
      >
        <Mail className="h-4 w-4" />
        {sending ? "Sending…" : onFile ? label : "Send"}
      </Button>
    </div>
  );
}
