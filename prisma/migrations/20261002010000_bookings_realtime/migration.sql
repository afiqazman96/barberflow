-- Appointments move from the browser into the database.
--
-- 1. The booking keeps the email it was made with, for the receipt after
--    check-in — the CRM record matched by phone may hold a different one.
ALTER TABLE "bookings" ADD COLUMN "customerEmail" TEXT;

-- 2. Tell every open screen when a branch's bookings change, exactly as
--    20260930000000_queue_realtime_broadcast does for tickets: a signal-only
--    Broadcast on the branch topic, after which screens re-read from our own
--    server. No booking data and no booking id — the id is what proves a
--    booking belongs to the customer holding it (src/lib/bookings/cookie.ts),
--    and the topic is public.

CREATE OR REPLACE FUNCTION public.broadcast_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  booking record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    booking := OLD;
  ELSE
    booking := NEW;
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'booking_changed',
        'queue:branch:' || booking."branchId",
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- A failed poke must never roll back the booking write itself.
      RAISE WARNING 'booking broadcast failed: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_booking_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS bookings_broadcast ON public.bookings;
CREATE TRIGGER bookings_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_booking_change();
