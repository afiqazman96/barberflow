import { generateMonthlyInvoices, processOverdueInvoices } from "@/lib/billing/actions";
import { shopToday } from "@/lib/shop/queries";

/**
 * Runs daily (`vercel.json`'s `crons`), not monthly — both steps below are
 * self-gating (generate only does anything on the 1st; the overdue check
 * only acts on invoices whose due date has actually passed), so a single
 * daily trigger safely covers "create this month's invoices" and "suspend
 * anyone who hasn't paid" without needing two separately-scheduled jobs.
 *
 * `?date=` is a manual-testing override, still behind the same secret check
 * — it lets the "is it the 1st" gate be proven deterministically without
 * waiting for a real month boundary.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateOverride = new URL(request.url).searchParams.get("date");
  const today = dateOverride ?? shopToday("Asia/Kuala_Lumpur");

  const generated = await generateMonthlyInvoices(today);
  const processed = await processOverdueInvoices(today);

  return Response.json({ ok: true, today, ...generated, ...processed });
}
