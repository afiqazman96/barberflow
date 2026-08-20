import type { StaffRole } from "@/generated/prisma/enums";
import type { UserRole } from "@/lib/types";

/**
 * The domain model and the UI name the same roles differently: Prisma has
 * `BARBER`, the app routes and store call it `staff`. These two functions are
 * the only place that gap is bridged — no `role === "BARBER"` comparisons
 * anywhere else.
 *
 * Pure and dependency-free so both Server Components and Client Components can
 * import them.
 */
export function appRoleFor(role: StaffRole): Exclude<UserRole, "super-admin" | "customer"> {
  switch (role) {
    case "OWNER":
      return "owner";
    case "CASHIER":
      return "cashier";
    case "BARBER":
      return "staff";
  }
}

/** Where a signed-in user lands after login, and where a wrong-portal visit is bounced to. */
export function homeRouteFor(role: UserRole): string {
  switch (role) {
    case "owner":
      return "/owner/dashboard";
    case "cashier":
      return "/cashier/dashboard";
    case "staff":
      return "/staff/dashboard";
    case "super-admin":
      return "/super-admin/dashboard";
    case "customer":
      return "/customer/home";
  }
}
