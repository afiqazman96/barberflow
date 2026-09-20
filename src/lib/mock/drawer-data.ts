import type { CashMovement, DrawerSession } from "@/lib/types";
import { localIso } from "@/lib/roster";

function at(daysBack: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function sales(day: number, amounts: number[]): CashMovement[] {
  return amounts.map((amount, i) => ({
    id: `cm-seed-${day}-${i}`,
    type: "sale" as const,
    amount,
    note: `FH-KL-${1000 + day * 10 + i}`,
    at: at(day, 11 + i),
    by: "Siti Nurhaliza",
  }));
}

/** Two past closes so the owner's history isn't empty: one clean, one flagged. */
export const DRAWER_HISTORY: DrawerSession[] = [
  {
    id: "drw-seed-2",
    branchId: "b1",
    cashierId: "c1",
    cashierName: "Siti Nurhaliza",
    openedAt: at(2, 10, 2),
    openingFloat: 200,
    movements: [
      ...sales(2, [38, 45, 76]),
      {
        id: "cm-seed-2-out",
        type: "pay-out",
        amount: -100,
        note: "Bank drop",
        at: at(2, 17),
        by: "Siti Nurhaliza",
        category: "Bank drop",
      },
    ],
    closedAt: at(2, 19, 5),
    closedBy: "Siti Nurhaliza",
    expectedAtClose: 259,
    countedAmount: 261,
    variance: 2,
    counts: [{ amount: 261, at: at(2, 19, 5) }],
    status: "closed",
  },
  {
    id: "drw-seed-1",
    branchId: "b1",
    cashierId: "c1",
    cashierName: "Siti Nurhaliza",
    openedAt: at(1, 10, 4),
    openingFloat: 200,
    movements: sales(1, [50, 93, 28, 65]),
    closedAt: at(1, 19, 8),
    closedBy: "Siti Nurhaliza",
    expectedAtClose: 436,
    countedAmount: 424,
    variance: -12,
    counts: [
      { amount: 419, at: at(1, 19, 4) },
      { amount: 424, at: at(1, 19, 8) },
    ],
    status: "needs-review",
    varianceReason: "Gave RM10 change twice on the RM65 cut, noticed too late",
    floatMismatch: 0,
  },
];

export const DRAWER_SEED_DATE = localIso(new Date());
