-- Tell every open screen when someone at a branch changes status.
--
-- Same mechanism as 20260930000000_queue_realtime_broadcast, on the same
-- branch topic: a signal-only Realtime Broadcast, after which each screen
-- re-reads the queue snapshot (which carries the branch's staff statuses) from
-- our own server. Nothing about the staff member travels over the socket.
--
-- Only `status` and `branchId` matter here — a profile edit does not need to
-- wake every lobby screen. A transfer pokes both the old and the new branch.

CREATE OR REPLACE FUNCTION public.broadcast_staff_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NOT NULL THEN
    BEGIN
      IF NEW."branchId" IS NOT NULL THEN
        PERFORM realtime.send(
          jsonb_build_object('op', TG_OP),
          'staff_changed',
          'queue:branch:' || NEW."branchId",
          false
        );
      END IF;
      IF OLD."branchId" IS NOT NULL
         AND OLD."branchId" IS DISTINCT FROM NEW."branchId" THEN
        PERFORM realtime.send(
          jsonb_build_object('op', TG_OP),
          'staff_changed',
          'queue:branch:' || OLD."branchId",
          false
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- A failed poke must never roll back the status change itself.
      RAISE WARNING 'staff broadcast failed: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_staff_status_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS staff_status_broadcast ON public.staff;
CREATE TRIGGER staff_status_broadcast
AFTER UPDATE OF status, "branchId" ON public.staff
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
      OR OLD."branchId" IS DISTINCT FROM NEW."branchId")
EXECUTE FUNCTION public.broadcast_staff_status_change();
