export type UserRole =
  | "Admin"
  | "Manager"
  | "Sales"
  | "Finance";

/*
 * Temporary compatibility only while old database users are migrated.
 * New users cannot be created with these roles.
 */
export type LegacyUserRole =
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
  | "automations"
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
    "whatsapp",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "automations",
    "settings",
    "userManagement",
  ],

  Manager: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "whatsapp",
    "finance",
    "documents",
    "inventory",
    "deals",
    "reports",
    "automations",
    "settings",
  ],

  Sales: [
    "dashboard",
    "leads",
    "leadDetail",
    "pipeline",
    "tasks",
    "calendar",
    "customers",
    "whatsapp",
    "documents",
    "inventory",
    "deals",
  ],

  Finance: [
    "dashboard",
    "tasks",
    "finance",
    "documents",
  ],
};

export function normalizeRole(
  role: string | null | undefined
): UserRole | null {
  if (!role) return null;

  if (
    role === "Admin" ||
    role === "Manager" ||
    role === "Sales" ||
    role === "Finance"
  ) {
    return role;
  }

  /*
   * Temporary migration fallback:
   * Stock users behave as Managers.
   * ReadOnly users behave as Sales until SQL migration runs.
   */
  if (role === "Stock") return "Manager";
  if (role === "ReadOnly") return "Sales";

  return null;
}

export function canAccessRole(
  role: string | null | undefined,
  module: AppModule
): boolean {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) return false;

  return permissions[normalizedRole].includes(module);
}

export function isReadOnlyRole(
  role: string | null | undefined
): boolean {
  /*
   * Retained so older components still compile.
   * After the migration there is no ReadOnly role.
   */
  return role === "ReadOnly";
}

export function canWriteRole(
  role: string | null | undefined
): boolean {
  return normalizeRole(role) !== null;
}

export function canManageUsers(
  role: string | null | undefined
): boolean {
  return normalizeRole(role) === "Admin";
}

export function canManageSettings(
  role: string | null | undefined
): boolean {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "Admin" ||
    normalizedRole === "Manager"
  );
}

export function canManageInventory(
  role: string | null | undefined
): boolean {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "Admin" ||
    normalizedRole === "Manager"
  );
}

export function canManageFinance(
  role: string | null | undefined
): boolean {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "Admin" ||
    normalizedRole === "Manager" ||
    normalizedRole === "Finance"
  );
}

export function canManageDeals(
  role: string | null | undefined
): boolean {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "Admin" ||
    normalizedRole === "Manager" ||
    normalizedRole === "Sales"
  );
}
