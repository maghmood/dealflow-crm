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
  | "finance"
  | "documents"
  | "inventory"
  | "reports"
  | "settings"
  | "userManagement";

const permissions: Record<UserRole, AppModule[]> = {
  Admin: [
    "dashboard",
    "leads",
    "leadDetail",
    "finance",
    "documents",
    "inventory",
    "reports",
    "settings",
    "userManagement",
  ],

  Manager: [
    "dashboard",
    "leads",
    "leadDetail",
    "finance",
    "documents",
    "inventory",
    "reports",
  ],

  Sales: ["dashboard", "leads", "leadDetail", "documents"],

  Finance: ["dashboard", "leadDetail", "finance", "documents", "reports"],

  Stock: ["dashboard", "documents", "inventory", "reports"],

  ReadOnly: [
    "dashboard",
    "leads",
    "leadDetail",
    "finance",
    "documents",
    "inventory",
    "reports",
  ],
};

export function canAccessRole(
  role: UserRole | null | undefined,
  module: AppModule
): boolean {
  if (!role) return false;
  return permissions[role]?.includes(module) || false;
}