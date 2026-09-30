"use client";

import { useEffect, useRef, useState } from "react";

import {
  fetchQueueSnapshot,
  registerQueueRefetch,
  type QueueScope,
} from "@/lib/queue/client";
import { QUEUE_CHANGED_EVENT, queueTopic } from "@/lib/queue/dto";
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
 * Keeps `store.queue` equal to the database.
 *
 * Realtime only ever says "this branch's queue changed". The tickets
 * themselves are re-read from our own server, which is where the session and
 * tenant checks live — so nothing about a customer travels over the socket,
 * and the `public` schema stays closed to the browser key.
 *
 * `branchId` is only read for the public scope; staff get their branches from
 * their session.
 */
export function useQueueSync(kind: QueueScope["kind"], branchId: string) {
  const hydrateQueue = useAppStore((s) => s.hydrateQueue);
  // The branches the last snapshot covered, i.e. the topics to listen on.
  const [topics, setTopics] = useState<string[]>([]);
  const schedule = useRef<() => void>(() => {});

  useEffect(() => {
    const scope: QueueScope =
      kind === "staff" ? { kind } : { kind, branchId };

    let cancelled = false;
    let inFlight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refetch() {
      if (inFlight) {
        // Something changed while we were reading; read once more after.
        again = true;
        return;
      }
      inFlight = true;
      const snapshot = await fetchQueueSnapshot(scope);
      inFlight = false;
      if (cancelled) return;

      if (snapshot) {
        hydrateQueue(snapshot);
        setTopics((current) =>
          current.join() === snapshot.branchIds.join()
            ? current
            : snapshot.branchIds,
        );
      }
      if (again) {
        again = false;
        void refetch();
      }
    }

    schedule.current = () => {
      clearTimeout(timer);
      timer = setTimeout(refetch, DEBOUNCE_MS);
    };

    void refetch();

    const poll = setInterval(refetch, POLL_MS);
    // A phone that was asleep in a pocket has missed every poke since.
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule.current();
    };
    const onOnline = () => schedule.current();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const unregister = registerQueueRefetch(() => schedule.current());

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      unregister();
      schedule.current = () => {};
    };
  }, [kind, branchId, hydrateQueue]);

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
          schedule.current(),
        )
        .subscribe((status) => {
          // Also fires on every re-join after a dropped connection, which is
          // exactly when pokes will have been missed.
          if (status === "SUBSCRIBED") schedule.current();
        }),
    );

    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [topicKey]);
}
