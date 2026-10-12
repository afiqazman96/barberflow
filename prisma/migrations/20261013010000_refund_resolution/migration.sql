-- Voiding a CARD/QR sale never puts money back by itself — that only happens
-- on the payment terminal, outside this app. refundPending already flagged a
-- cash void with no open drawer, but had no way to say "handled"; this adds
-- that, and the same pair now also clears the card/QR case.
ALTER TABLE "sales" ADD COLUMN "refundResolvedAt" TIMESTAMP(3);
ALTER TABLE "sales" ADD COLUMN "refundResolvedById" TEXT;
ALTER TABLE "sales" ADD COLUMN "refundResolvedByName" TEXT;
