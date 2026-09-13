"use client";

import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { PosSubnav } from "@/components/domain/pos-subnav";
import { SalesHistory } from "@/components/domain/sales-history";

export default function CashierSalesPage() {
  return (
    <>
      <Topbar title="Point of Sale" />
      <PosSubnav base="/cashier/pos" />
      <PageTransition>
        <SalesHistory />
      </PageTransition>
    </>
  );
}
