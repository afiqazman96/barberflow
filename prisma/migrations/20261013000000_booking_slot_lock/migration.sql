-- A specific barber can hold only one slot at a time. The application now
-- also checks and writes this inside a Serializable transaction (which is
-- what actually stops two "any barber" bookings from overfilling a slot,
-- since a null staffId can't be constrained this way) — this index is the
-- backstop for the common case of a named barber, and the second half of
-- what a Serializable conflict falls back to if it's ever bypassed.
-- Prisma cannot express a partial index, so it is declared here only, the
-- same way shifts_one_open_per_staff is.
CREATE UNIQUE INDEX "bookings_staff_slot_key" ON "bookings"("branchId", "staffId", "scheduledAt")
  WHERE "staffId" IS NOT NULL AND "status" IN ('CONFIRMED', 'CHECKED_IN');
