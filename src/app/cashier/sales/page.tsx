"use client";

import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { SalesHistory } from "@/components/domain/sales-history";

export default function CashierSalesPage() {
  return (
    <>
      <Topbar title="Sales & Receipts" />
      <PageTransition>
        <SalesHistory />
      </PageTransition>
    </>
  );
}
