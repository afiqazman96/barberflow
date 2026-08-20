-- Move credentials out of the database and into Supabase Auth.
--
-- DESTRUCTIVE: drops `passwordHash` from staff and platform_admins. Existing
-- bcrypt hashes cannot be imported into Supabase Auth, so every account must be
-- re-provisioned there (see prisma/seed.ts) and relinked via `authUserId`.
--
-- `staff.email` becomes globally unique because Supabase Auth keys accounts on
-- email; the previous per-tenant uniqueness is dropped. This migration will
-- fail if two tenants currently share a staff email — deduplicate first.

-- DropIndex
DROP INDEX "staff_tenantId_email_key";

-- AlterTable
ALTER TABLE "platform_admins" DROP COLUMN "passwordHash",
ADD COLUMN     "authUserId" UUID;

-- AlterTable
ALTER TABLE "staff" DROP COLUMN "passwordHash",
ADD COLUMN     "authUserId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_authUserId_key" ON "platform_admins"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_authUserId_key" ON "staff"("authUserId");

-- CreateIndex
CREATE INDEX "staff_tenantId_idx" ON "staff"("tenantId");

