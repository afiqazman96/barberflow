-- A record that the shop paid a barber their earned commission. Nothing
-- about what's owed is stored here — that's Sale.commission earned minus
-- these payouts, computed fresh each time from the sales it's actually
-- based on, so it can never drift out of sync with them.
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT NOT NULL,
    "paidByName" TEXT NOT NULL,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_payouts_tenantId_staffId_idx" ON "commission_payouts"("tenantId", "staffId");

ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS is not inherited (AGENTS.md). The revoked default privileges already
-- keep `anon` / `authenticated` off this table; this closes it for good.
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;
