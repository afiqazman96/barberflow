-- An owner had no way to retire a branch: every booking, sale and queue
-- ticket cascades from it, so a hard delete would destroy that history.
-- Mirrors tenants.archived/archivedAt (20261011000000_tenant_archive) —
-- hidden from active use, kept on record, restorable.
ALTER TABLE "branches" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "branches_archived_idx" ON "branches"("archived");
