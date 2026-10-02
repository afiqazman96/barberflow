import { toast } from "sonner";

import type { ActionResult } from "@/lib/auth/types";
import { requestQueueRefetch } from "@/lib/queue/client";
import type { Customer, MembershipPlan, Product, Service } from "@/lib/types";

import {
  adjustProductStock,
  createCustomer,
  removeMembershipPlan,
  saveMembershipPlan,
  saveProduct,
  saveService,
  updateCustomer,
} from "./actions";

/**
 * The browser's side of the catalogue and customer list. The store applies a
 * change locally, then persists it here; the refetch its write triggers swaps
 * any temporary id for the stored one. On refusal, say why and re-read.
 */

function persist(title: string, write: () => Promise<ActionResult>): void {
  const failed = (description?: string) => {
    toast.error(title, { description });
    requestQueueRefetch();
  };
  write().then(
    (result) => {
      if (!result.ok) failed(result.error);
    },
    () => failed("Check your connection and try again"),
  );
}

/**
 * A key present but `undefined` means "removed" on the screen; over the wire
 * it would vanish and read as "unchanged", so send `null`.
 */
function withImage<T extends { imageUrl?: string }>(patch: T) {
  return "imageUrl" in patch ? { ...patch, imageUrl: patch.imageUrl ?? null } : patch;
}

export function pushNewService(service: Omit<Service, "id">): void {
  persist("Couldn't add the service", () => saveService(null, withImage(service)));
}

export function pushServicePatch(id: string, patch: Partial<Service>): void {
  const { id: _id, ...rest } = patch;
  void _id;
  persist("Couldn't save the service", () => saveService(id, withImage(rest)));
}

export function pushNewProduct(product: Omit<Product, "id">): void {
  persist("Couldn't add the product", () => saveProduct(null, withImage(product)));
}

export function pushProductPatch(id: string, patch: Partial<Omit<Product, "stock">>): void {
  const { id: _id, ...rest } = patch;
  void _id;
  persist("Couldn't save the product", () => saveProduct(id, withImage(rest)));
}

export function pushStockChange(id: string, delta: number): void {
  persist("Couldn't update the stock", () => adjustProductStock(id, delta));
}

export function pushMembershipPlan(id: string | null, plan: Omit<MembershipPlan, "id" | "members">): void {
  persist("Couldn't save the plan", () => saveMembershipPlan(id, plan));
}

export function pushRemoveMembershipPlan(id: string): void {
  persist("Couldn't remove the plan", () => removeMembershipPlan(id));
}

/**
 * Customer records are saved before they are shown: a phone number or email
 * someone else already has is refused, and the counter needs to know that
 * before they move on, not after a "Customer added" that turns out untrue.
 */
export async function saveNewCustomer(
  customer: Omit<Customer, "id" | "visits" | "totalSpent" | "lastVisit">,
): Promise<ActionResult<{ id: string }>> {
  try {
    return await createCustomer(customer);
  } catch {
    return { ok: false, error: "Check your connection and try again" };
  }
}

export async function saveCustomerPatch(id: string, patch: Partial<Customer>): Promise<ActionResult> {
  const { name, phone, email, membership, notes, preferredStaffId } = patch;
  try {
    return await updateCustomer(id, {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      // Cleared on the screen is `undefined` here: send it as empty.
      ...("email" in patch ? { email: email ?? "" } : {}),
      ...(membership !== undefined ? { membership } : {}),
      ...("notes" in patch ? { notes: notes ?? "" } : {}),
      ...("preferredStaffId" in patch ? { preferredStaffId: preferredStaffId ?? "" } : {}),
    });
  } catch {
    return { ok: false, error: "Check your connection and try again" };
  }
}
