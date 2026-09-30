-- Tell every open screen when a branch's queue changes.
--
-- The queue is read and written only through Prisma, and `public` stays closed
-- to PostgREST (20260820000000_lock_down_postgrest_access). So rather than let
-- browsers subscribe to the table — which would mean granting `anon` SELECT on
-- `queue_tickets` and writing RLS for customers who never log in — this sends a
-- Realtime *Broadcast* on the branch's topic. The message is a poke with no
-- ticket data in it: on receipt a screen re-reads the queue from our own
-- server, which applies the session and tenant checks as usual.
--
-- It deliberately does not carry the ticket id either. The id is what proves a
-- ticket belongs to the customer holding it (src/lib/queue/cookie.ts), and the
-- topic is public.
--
-- A trigger rather than a call from the server actions, so that no write path
-- (an action, the seed, Prisma Studio, a future job) can change a ticket
-- without the screens hearing, and so the poke is only ever delivered for a
-- write that actually committed.
--
-- `realtime.send` only exists on Supabase. The function checks for it at call
-- time, so this migration applies cleanly — and the trigger is a no-op — on a
-- plain Postgres (local Docker, CI, Prisma's shadow database). Screens there
-- fall back to their slow poll.

CREATE OR REPLACE FUNCTION public.broadcast_queue_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ticket record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    ticket := OLD;
  ELSE
    ticket := NEW;
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'ticket_changed',
        'queue:branch:' || ticket."branchId",
        false  -- public topic: customers and the lobby TV have no login
      );
    EXCEPTION WHEN OTHERS THEN
      -- A Realtime hiccup must never roll back somebody's place in the queue.
      RAISE WARNING 'queue broadcast failed: %', SQLERRM;
    END;
  END IF;

  RETURN NULL;
END;
$$;

-- Trigger functions cannot be called over RPC, but there is no reason for the
-- API roles to hold EXECUTE on it either.
REVOKE ALL ON FUNCTION public.broadcast_queue_ticket_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS queue_tickets_broadcast ON public.queue_tickets;

CREATE TRIGGER queue_tickets_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.queue_tickets
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_queue_ticket_change();
