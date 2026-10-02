-- Shifts, the weekly roster, leave and the shop's operating rules move from
-- the browser into the database, so a clock-in on one device, a roster edit
-- by the owner or a changed booking rule is the same on every screen — and
-- the server can enforce the rules instead of trusting the browser.


-- CreateEnum
CREATE TYPE "ShiftActor" AS ENUM ('SELF', 'OWNER', 'AUTO');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "advanceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "cancelHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "maxWaitMins" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "slotInterval" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "chairId" TEXT,
    "startedBy" "ShiftActor" NOT NULL,
    "endedBy" "ShiftActor",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_days" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "off" BOOLEAN NOT NULL DEFAULT true,
    "start" TEXT NOT NULL DEFAULT '10:00',
    "end" TEXT NOT NULL DEFAULT '19:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_tenantId_date_idx" ON "shifts"("tenantId", "date");

-- CreateIndex
CREATE INDEX "shifts_staffId_endedAt_idx" ON "shifts"("staffId", "endedAt");

-- CreateIndex
CREATE INDEX "roster_days_tenantId_idx" ON "roster_days"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roster_days_staffId_weekday_key" ON "roster_days"("staffId", "weekday");

-- CreateIndex
CREATE INDEX "staff_leaves_tenantId_date_idx" ON "staff_leaves"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_leaves_staffId_date_key" ON "staff_leaves"("staffId", "date");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "chairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_days" ADD CONSTRAINT "roster_days_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_days" ADD CONSTRAINT "roster_days_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One open shift per person. Prisma cannot express a partial index, so it is
-- declared here only; two devices clocking the same person in at once get
-- one shift and a unique violation, not two open shifts.
CREATE UNIQUE INDEX "shifts_one_open_per_staff" ON "shifts"("staffId") WHERE "endedAt" IS NULL;

-- RLS is not inherited (AGENTS.md). The revoked default privileges already
-- keep `anon` / `authenticated` off these tables; this closes them for good.
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- Tell open screens the shop's set-up changed, on each affected branch's
-- topic, the same signal-only way as the queue and bookings. Settings belong
-- to the whole shop, so they poke every branch.
CREATE OR REPLACE FUNCTION public.broadcast_shop_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  row_data jsonb;
  branch_ids text[];
  branch_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    IF TG_TABLE_NAME = 'tenant_settings' THEN
      SELECT array_agg(b.id) INTO branch_ids
      FROM public.branches b WHERE b."tenantId" = row_data->>'tenantId';
    ELSIF row_data ? 'branchId' THEN
      branch_ids := ARRAY[row_data->>'branchId'];
    ELSE
      SELECT array_agg(s."branchId") INTO branch_ids
      FROM public.staff s
      WHERE s.id = row_data->>'staffId' AND s."branchId" IS NOT NULL;
    END IF;

    FOREACH branch_id IN ARRAY coalesce(branch_ids, ARRAY[]::text[]) LOOP
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'shop_changed',
        'queue:branch:' || branch_id,
        false
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- A failed poke must never roll back the write itself.
    RAISE WARNING 'shop broadcast failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_shop_change() FROM PUBLIC;

CREATE TRIGGER shifts_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

CREATE TRIGGER roster_days_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.roster_days
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

CREATE TRIGGER staff_leaves_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.staff_leaves
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

CREATE TRIGGER tenant_settings_broadcast
AFTER UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();
