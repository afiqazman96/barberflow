-- Offboarding a tenant is distinct from suspending one: a suspended tenant
-- still shows in the active list and can be reactivated from its own status;
-- an archived one is hidden from the active list entirely and its MRR no
-- longer counts, but its data (and the row itself) is kept.
ALTER TABLE "tenants"
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "tenants_archived_idx" ON "tenants"("archived");
