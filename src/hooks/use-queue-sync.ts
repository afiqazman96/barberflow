"use client";

import { useEffect, useRef, useState } from "react";

import { fetchBookingsSnapshot } from "@/lib/bookings/client";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/dto";
import {
  fetchQueueSnapshot,
  registerQueueRefetch,
  type QueueScope,
} from "@/lib/queue/client";
import {
  QUEUE_CHANGED_EVENT,
  queueTopic,
  STAFF_CHANGED_EVENT,
} from "@/lib/queue/dto";
import { useAppStore } from "@/lib/store/app-store";
import { createClient } from "@/lib/supabase/client";

/** A burst of writes (a walk-in is several rows) should cost one refetch. */
const DEBOUNCE_MS = 150;

/**
 * Safety net for a poke that never arrives — a dropped socket, or a database
 * without Supabase Realtime at all (local Docker).
 */
const POLL_MS = 45_000;

/**
 * One snapshot kept in step with the database: re-read on demand, debounced,
 * never two reads in flight, and once more if asked while one was running.
 */
function createRefetcher<T>(
  read: () => Promise<T | null>,
  apply: (snapshot: T) => void,
  isCancelled: () => boolean,
) {
  let inFlight = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function run() {
    if (inFlight) {
      // Something changed while we were reading; read once more after.
      again = true;
      return;
    }
    inFlight = true;
    const snapshot = await read();
    inFlight = false;
    if (isCancelled()) return;
    if (snapshot) apply(snapshot);
    if (again) {
      again = false;
      void run();
    }
  }

  return {
    run,
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}

type Schedulers = { queue: () => void; bookings: () => void };

/**
 * Keeps `store.queue` — and, when asked, `store.bookings` — equal to the
 * database.
 *
 * Realtime only ever says "this branch's queue / staff / bookings changed".
 * The data itself is re-read from our own server, which is where the session
 * and tenant checks live — so nothing about a customer travels over the
 * socket, and the `public` schema stays closed to the browser key.
 *
 * `branchId` is only read for the public scope; staff get their branches from
 * their session.
 */
export function useQueueSync(
  kind: QueueScope["kind"],
  branchId: string,
  withBookings: boolean,
) {
  const hydrateQueue = useAppStore((s) => s.hydrateQueue);
  const hydrateBookings = useAppStore((s) => s.hydrateBookings);
  // The branches the last snapshot covered, i.e. the topics to listen on.
  const [topics, setTopics] = useState<string[]>([]);
  const schedule = useRef<Schedulers>({ queue: () => {}, bookings: () => {} });

  useEffect(() => {
    const scope: QueueScope =
      kind === "staff" ? { kind } : { kind, branchId };

    let cancelled = false;
    const isCancelled = () => cancelled;

    const queue = createRefetcher(
      () => fetchQueueSnapshot(scope),
      (snapshot) => {
        hydrateQueue(snapshot);
        setTopics((current) =>
          current.join() === snapshot.branchIds.join()
            ? current
            : snapshot.branchIds,
        );
      },
      isCancelled,
    );
    const bookings = withBookings
      ? createRefetcher(
          () => fetchBookingsSnapshot(scope),
          hydrateBookings,
          isCancelled,
        )
      : null;

    const all = () => {
      queue.schedule();
      bookings?.schedule();
    };
    schedule.current = {
      queue: queue.schedule,
      bookings: bookings ? bookings.schedule : () => {},
    };

    void queue.run();
    void bookings?.run();

    const poll = setInterval(all, POLL_MS);
    // A phone that was asleep in a pocket has missed every poke since.
    const onVisible = () => {
      if (document.visibilityState === "visible") all();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", all);
    const unregister = registerQueueRefetch(all);

    return () => {
      cancelled = true;
      queue.stop();
      bookings?.stop();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", all);
      unregister();
      schedule.current = { queue: () => {}, bookings: () => {} };
    };
  }, [kind, branchId, withBookings, hydrateQueue, hydrateBookings]);

  const topicKey = topics.join();
  useEffect(() => {
    if (!topicKey) return;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      // No Supabase env (plain local Postgres): the poll above still runs.
      return;
    }

    const channels = topicKey.split(",").map((id) =>
      supabase
        .channel(queueTopic(id))
        .on("broadcast", { event: QUEUE_CHANGED_EVENT }, () =>
          schedule.current.queue(),
        )
        .on("broadcast", { event: STAFF_CHANGED_EVENT }, () =>
          schedule.current.queue(),
        )
        .on("broadcast", { event: BOOKINGS_CHANGED_EVENT }, () =>
          schedule.current.bookings(),
        )
        .subscribe((status) => {
          // Also fires on every re-join after a dropped connection, which is
          // exactly when pokes will have been missed.
          if (status === "SUBSCRIBED") {
            schedule.current.queue();
            schedule.current.bookings();
          }
        }),
    );

    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [topicKey]);
}
