/**
 * Bookings are stored as an absolute instant (`Booking.scheduledAt`, UTC) but
 * every screen speaks in the shop's wall clock: a `date` of `2026-10-02` and a
 * `time` of `14:30`. These convert between the two in the tenant's timezone,
 * whatever zone the server or the browser happens to run in.
 */

const FALLBACK_ZONE = "Asia/Kuala_Lumpur";

function partsIn(instant: Date, timeZone: string) {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone);
  } catch {
    // An unknown zone name in settings must not take bookings down.
    parts = format(FALLBACK_ZONE);
  }
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far `timeZone` is ahead of UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** `2026-10-02` + `14:30` on the shop's clock → the instant it happens. */
export function shopTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const naive = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(naive.getTime())) return null;

  // Two passes: the offset at the naive guess can differ from the offset at
  // the real instant when a DST change falls in between.
  const first = new Date(naive.getTime() - offsetMinutes(naive, timeZone) * 60_000);
  const second = offsetMinutes(first, timeZone);
  return new Date(naive.getTime() - second * 60_000);
}

/** The instant → the shop's `date` and `time`, as the screens show them. */
export function instantToShopTime(
  instant: Date,
  timeZone: string,
): { date: string; time: string } {
  const p = partsIn(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}
