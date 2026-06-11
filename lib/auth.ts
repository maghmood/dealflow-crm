export type UserRole =
  | "Admin"
  | "Manager"
  | "Sales"
  | "Finance"
  | "Stock"
  | "ReadOnly";

export type AppModule =
  | "dashboard"
  | "leads"
  | "leadDetail"
  | "pipeline"
  | "tasks"
  | "calendar"
  | "customers"
  | "whatsapp"
  | "finance"
  | "documents"
  | "inventory"
  | "deals"
  | "reports"
  | "settings"
  | "userManagement";

const permissions: Record<UserRole, AppModule[]> = {
  Admin: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "settings",
    "userManagement",
    "whatsapp",
  ],

  Manager: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "settings",
    "whatsapp",
  ],

  Sales: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "documents",
    "inventory",
    "deals",
    "whatsapp",
  ],

  Finance: [
    "dashboard",
    "leadDetail",
    "tasks",
    "calendar",
    "customers",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "whatsapp",
  ],

  Stock: [
    "dashboard",
    "customers",
    "documents",
    "inventory",
    "deals",
    "reports",
  ],

  ReadOnly: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "whatsapp",
  ],
};

export function canAccessRole(
  role: UserRole | null | undefined,
  module: AppModule
): boolean {
  if (!role) return false;
  return permissions[role]?.includes(module) || false;
}

export function isReadOnlyRole(role: UserRole | null | undefined): boolean {
  return role === "ReadOnly";
}

export function canWriteRole(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return role !== "ReadOnly";
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return role === "Admin";
}

export function canManageSettings(role: UserRole | null | undefined): boolean {
  return role === "Admin" || role === "Manager";
}

export function canManageInventory(role: UserRole | null | undefined): boolean {
  return role === "Admin" || role === "Manager" || role === "Stock";
}

export function canManageFinance(role: UserRole | null | undefined): boolean {
  return role === "Admin" || role === "Manager" || role === "Finance";
}

export function canManageDeals(role: UserRole | null | undefined): boolean {
  return role === "Admin" || role === "Manager" || role === "Sales" || role === "Finance";
}