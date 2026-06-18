"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  severity: "red" | "orange" | "blue" | "green";
  source: "task" | "communication";
};

type Company = {
  company_name: string | null;
  logo_url: string | null;
  theme_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
};

const fallbackBranding: Company = {
  company_name: "DealFlow CRM",
  logo_url: null,
  theme_name: "Slate",
  primary_color: "#0f172a",
  accent_color: "#2563eb",
  sidebar_color: "#0f172a",
};

function getHoverColor(hex: string) {
  const safeHex = hex.replace("#", "");

  if (safeHex.length !== 6) return "#334155";

  const r = Math.max(parseInt(safeHex.substring(0, 2), 16) - 22, 0);
  const g = Math.max(parseInt(safeHex.substring(2, 4), 16) - 22, 0);
  const b = Math.max(parseInt(safeHex.substring(4, 6), 16) - 22, 0);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
  profile,
  loading: authLoading,
} = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [branding, setBranding] = useState<Company>(fallbackBranding);

    const navItems = [
    ...(canAccessRole(profile?.role, "dashboard")
      ? [{ label: "Dashboard", href: "/" }]
      : []),

    ...(canAccessRole(profile?.role, "leads")
      ? [{ label: "Leads", href: "/leads" }]
      : []),

    ...(canAccessRole(profile?.role, "pipeline")
      ? [{ label: "Pipeline", href: "/pipeline" }]
      : []),

    ...(canAccessRole(profile?.role, "tasks")
      ? [{ label: "Tasks", href: "/tasks" }]
      : []),

    ...(canAccessRole(profile?.role, "calendar")
      ? [{ label: "Calendar", href: "/calendar" }]
      : []),

    ...(canAccessRole(profile?.role, "customers")
      ? [{ label: "Customers", href: "/customers" }]
      : []),

    ...(canAccessRole(profile?.role, "inventory")
      ? [{ label: "Inventory", href: "/inventory" }]
      : []),

    ...(canAccessRole(profile?.role, "deals")
      ? [{ label: "Deals", href: "/deals" }]
      : []),

    ...(canAccessRole(profile?.role, "finance")
      ? [{ label: "Finance", href: "/finance" }]
      : []),

    ...(canAccessRole(profile?.role, "documents")
      ? [{ label: "Documents", href: "/documents" }]
      : []),

    ...(canAccessRole(profile?.role, "reports")
      ? [{ label: "Reports", href: "/reports" }]
      : []),

          ...(canAccessRole(profile?.role, "automations")
      ? [
          {
            label: "Automation Monitoring",
            href: "/automations",
          },
        ]
      : []),
  ];

  async function fetchNotifications() {
  if (!profile?.company_id) return;

  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, title, due_date, status, lead_id, assigned_user_id"
    )
    .eq("company_id", profile.company_id)
    .neq("status", "Completed")
    .order("due_date", { ascending: true });

  let communicationQuery = supabase
    .from("communication_logs")
    .select(
      "id, lead_id, channel, send_status, customer_name, created_by_id, created_by_name, created_at, resolved_at"
    )
    .eq("company_id", profile.company_id)
    .is("resolved_at", null)
    .in("send_status", [
      "Pending Outcome",
      "Sent Manually",
      "Follow-up Created",
    ])
    .order("created_at", { ascending: false })
    .limit(20);

  if (profile.role === "Sales") {
    taskQuery = taskQuery.eq("assigned_user_id", profile.id);

    communicationQuery = communicationQuery.eq(
      "created_by_id",
      profile.id
    );
  }

  if (profile.role === "Finance") {
    taskQuery = taskQuery
      .eq("assigned_user_id", profile.id)
      .eq("task_scope", "Finance");

    communicationQuery = communicationQuery.eq("id", -1);
  }

  const [taskResult, communicationResult] = await Promise.all([
    taskQuery,
    communicationQuery,
  ]);

  const items: NotificationItem[] = [];

  if (taskResult.error) {
    console.error(
      "Error loading task notifications:",
      taskResult.error.message
    );
  } else {
    const now = new Date();

    const taskRows = taskResult.data || [];
    const taskLeadIds = Array.from(
      new Set(
        taskRows
          .map((task: any) => task.lead_id)
          .filter(Boolean)
      )
    ) as number[];

    let taskCustomerMap = new Map<number, string>();

    if (taskLeadIds.length > 0) {
      const { data: taskLeadData, error: taskLeadError } =
        await supabase
          .from("leads")
          .select("id, customer")
          .eq("company_id", profile.company_id)
          .in("id", taskLeadIds);

      if (taskLeadError) {
        console.error(
          "Error loading notification customer names:",
          taskLeadError.message
        );
      } else {
        taskCustomerMap = new Map(
          (taskLeadData || []).map((lead: any) => [
            Number(lead.id),
            lead.customer || "Unknown Customer",
          ])
        );
      }
    }

    const taskItems: NotificationItem[] = taskRows
      .map((task: any) => {
        const dueDate = task.due_date
          ? new Date(task.due_date)
          : null;

        if (!dueDate) return null;

        const isOverdue = dueDate < now;

        const isDueToday =
          dueDate.getDate() === now.getDate() &&
          dueDate.getMonth() === now.getMonth() &&
          dueDate.getFullYear() === now.getFullYear();

        if (!isOverdue && !isDueToday) return null;

        return {
          id: `task-${task.id}`,
          title: isOverdue
            ? "Overdue Task"
            : "Task Due Today",
          message: task.lead_id
            ? `${taskCustomerMap.get(task.lead_id) || "Customer"} • ${task.title}`
            : `General Task • ${task.title}`,
          href: `/tasks?taskId=${task.id}`,
          severity: isOverdue ? "red" : "orange",
          source: "task",
        } satisfies NotificationItem;
      })
      .filter(Boolean) as NotificationItem[];

    items.push(...taskItems);
  }

  if (communicationResult.error) {
    console.error(
      "Error loading communication notifications:",
      communicationResult.error.message
    );
  } else {
    const communicationItems: NotificationItem[] = (
      communicationResult.data || []
    ).map((log: any) => {
      const customerName =
        log.customer_name ||
        (log.lead_id ? `Lead #${log.lead_id}` : "Customer");

      return {
        id: `communication-${log.id}`,
        title: `${log.channel || "Communication"} Outcome Pending`,
        message: `${customerName} • ${log.created_by_name || "User"} has not resolved this communication action.`,
        href: log.lead_id ? `/leads/${log.lead_id}` : "/tasks",
        severity: "orange",
        source: "communication",
      };
    });

    items.push(...communicationItems);
  }

  setNotifications(items);
}

  async function fetchBranding() {
    const companyId = profile?.company_id || 1;

    const { data, error } = await supabase
      .from("companies")
      .select(
        "company_name, logo_url, theme_name, primary_color, accent_color, sidebar_color"
      )
      .eq("id", companyId)
      .single<Company>();

    if (!error && data) {
      setBranding({
        company_name: data.company_name || fallbackBranding.company_name,
        logo_url: data.logo_url || null,
        theme_name: data.theme_name || fallbackBranding.theme_name,
        primary_color: data.primary_color || fallbackBranding.primary_color,
        accent_color: data.accent_color || fallbackBranding.accent_color,
        sidebar_color: data.sidebar_color || fallbackBranding.sidebar_color,
      });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setShowUserMenu(false);
    router.push("/login");
  }

  useEffect(() => {
    fetchBranding();
    fetchNotifications();

    function handleBrandingUpdated() {
      void fetchBranding();
    }

    function handleTaskUpdated() {
      void fetchNotifications();
    }

    window.addEventListener(
      "dealflow-branding-updated",
      handleBrandingUpdated
    );

    window.addEventListener(
      "dealflow-task-updated",
      handleTaskUpdated
    );

    return () => {
      window.removeEventListener(
        "dealflow-branding-updated",
        handleBrandingUpdated
      );

      window.removeEventListener(
        "dealflow-task-updated",
        handleTaskUpdated
      );
    };
  }, [profile?.company_id, profile?.role, profile?.id]);

useEffect(() => {
  if (!profile?.company_id) return;

  const taskNotificationChannel = supabase
    .channel(
      `layout-task-notifications-${profile.company_id}-${profile.id}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `company_id=eq.${profile.company_id}`,
      },
      () => {
        void fetchNotifications();
      }
    )
    .subscribe((status, error) => {
      if (error) {
        console.error(
          "Task notification Realtime error:",
          error
        );
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Task notification channel status:",
          status
        );
      }
    });

  const communicationNotificationChannel = supabase
    .channel(
      `layout-communication-notifications-${profile.company_id}-${profile.id}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "communication_logs",
        filter: `company_id=eq.${profile.company_id}`,
      },
      () => {
        void fetchNotifications();
      }
    )
    .subscribe((status, error) => {
      if (error) {
        console.error(
          "Communication notification Realtime error:",
          error
        );
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Communication notification channel status:",
          status
        );
      }
    });

  return () => {
    supabase.removeChannel(taskNotificationChannel);
    supabase.removeChannel(communicationNotificationChannel);
  };
}, [
  profile?.company_id,
  profile?.role,
  profile?.id,
]);

  if (authLoading && !profile) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">
          Checking your account
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Please wait while DealFlow confirms your access.
        </p>
      </div>
    </div>
  );
}

if (!profile || profile.status !== "Active") {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-red-700">
          Account unavailable
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Your account is inactive or your session is no
          longer valid.
        </p>
      </div>
    </div>
  );
}
  const primaryColor = branding.primary_color || "#0f172a";
  const accentColor = branding.accent_color || "#2563eb";
  const sidebarColor = branding.sidebar_color || "#0f172a";

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div
      className="min-h-screen bg-slate-100"
      style={
        {
          "--brand-primary": primaryColor,
          "--brand-primary-hover": getHoverColor(primaryColor),
          "--brand-accent": accentColor,
          "--brand-accent-hover": getHoverColor(accentColor),
          "--brand-sidebar": sidebarColor,
          "--brand-sidebar-hover": getHoverColor(sidebarColor),
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-screen">
        <aside
          className="hidden w-72 flex-col text-white shadow-xl lg:flex"
          style={{ backgroundColor: sidebarColor }}
        >
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              {branding.logo_url ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white p-2">
                  <img
                    src={branding.logo_url}
                    alt={`${branding.company_name} logo`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 text-xl font-bold">
                  {(branding.company_name || "D").charAt(0)}
                </div>
              )}

              <div>
                <p className="text-lg font-bold leading-tight">
                  {branding.company_name}
                </p>
                <p className="text-xs text-white/60">
                  {branding.theme_name || "Slate"} theme
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4 text-xs text-white/50">
            DealFlow SaaS Platform
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">Welcome back</p>
              <h2 className="text-xl font-bold text-slate-800">
                {profile?.full_name || "User"}
              </h2>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowUserMenu(false);
                  }}
                  className="relative rounded-full border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50"
                >
                  🔔

                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 z-50 mt-4 w-[460px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-6 py-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-800">
                            Notifications
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
  Tasks and communication outcomes needing attention
</p>
                        </div>

                        <div className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                          {notifications.length} New
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[520px] overflow-y-auto bg-slate-50/50 p-4">
                      {notifications.length === 0 ? (
                        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
                            🔔
                          </div>

                          <h4 className="text-lg font-semibold text-slate-700">
                            All caught up
                          </h4>

                          <p className="mt-2 text-sm text-slate-500">
                            No urgent notifications right now.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {notifications.map((notification) => (
                            <Link
                              key={notification.id}
                              href={notification.href}
                              onClick={() => setShowNotifications(false)}
                              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                            >
                              <div className="flex items-start gap-4">
                                <div
  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
    notification.severity === "red"
      ? "bg-red-100 text-red-600"
      : notification.severity === "orange"
      ? "bg-orange-100 text-orange-600"
      : notification.severity === "green"
      ? "bg-green-100 text-green-600"
      : "bg-blue-100 text-blue-600"
  }`}
>
  {notification.source === "whatsapp"
    ? "💬"
    : notification.source === "communication"
    ? "📣"
    : notification.severity === "red"
    ? "⚠️"
    : notification.severity === "orange"
    ? "⏰"
    : "🔔"}
</div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="font-bold text-slate-800">
                                        {notification.title}
                                      </h4>

                                      <p className="mt-1 text-sm text-slate-500">
                                        {notification.message}
                                      </p>
                                    </div>

                                    <div
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        notification.severity === "red"
                                          ? "bg-red-100 text-red-700"
                                          : notification.severity === "orange"
                                          ? "bg-orange-100 text-orange-700"
                                          : "bg-blue-100 text-blue-700"
                                      }`}
                                    >
                                      {notification.severity === "red"
                                        ? "Overdue"
                                        : notification.severity === "orange"
                                        ? "Due Today"
                                        : "Update"}
                                    </div>
                                  </div>

                                  <div className="mt-4 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">
                                      {notification.source === "task"
                                        ? "Open task"
                                        : notification.source === "communication"
                                        ? "Open lead"
                                        : "Open conversation"}
                                    </span>

                                    <span className="text-sm font-semibold text-blue-700">
                                      View →
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 bg-white px-6 py-4">
                      <Link
                        href="/tasks"
                        onClick={() => setShowNotifications(false)}
                        className="flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        View All Tasks
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-slate-200" />

              <div className="relative">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowNotifications(false);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition hover:border-slate-200 hover:bg-slate-50"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {initials}
                  </div>

                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-slate-800">
                      {profile?.full_name || "User"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {profile?.role || "User"}
                    </p>
                  </div>

                  <span className="hidden text-xs text-slate-400 sm:inline">
                    ▾
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {initials}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {profile?.full_name || "User"}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {profile?.role || "User"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      {canAccessRole(profile?.role, "settings") && (
                        <Link
                          href="/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span>Settings</span>
                          <span className="text-slate-400">→</span>
                        </Link>
                      )}

                      {canAccessRole(profile?.role, "userManagement") && (
                        <Link
                          href="/settings/users"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span>User Management</span>
                          <span className="text-slate-400">→</span>
                        </Link>
                      )}

                      <button
                        onClick={logout}
                        className="mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <span>Log out</span>
                        <span>↗</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}