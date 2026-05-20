"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  href: string;
  severity: "red" | "orange" | "blue";
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
  const { profile } = useAuth();
const [showNotifications, setShowNotifications] = useState(false);
const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [branding, setBranding] = useState<Company>(fallbackBranding);

  const navItems = [
    ...(canAccessRole(profile?.role, "dashboard")
      ? [{ label: "Dashboard", href: "/" }]
      : []),

    ...(canAccessRole(profile?.role, "leads")
      ? [{ label: "Leads", href: "/leads" }]
      : []),

    ...(canAccessRole(profile?.role, "finance")
      ? [{ label: "Finance", href: "/finance" }]
      : []),

    ...(canAccessRole(profile?.role, "leads")
      ? [{ label: "Customers", href: "/customers" }]
      : []),

    ...(canAccessRole(profile?.role, "inventory")
      ? [{ label: "Inventory", href: "/inventory" }]
      : []),

    ...(canAccessRole(profile?.role, "finance")
      ? [{ label: "Deals", href: "/deals" }]
      : []),

    ...(canAccessRole(profile?.role, "documents")
      ? [{ label: "Documents", href: "/documents" }]
      : []),

    ...(canAccessRole(profile?.role, "leads")
      ? [{ label: "Tasks", href: "/tasks" }]
      : []),


    ...(canAccessRole(profile?.role, "leads")
      ? [{ label: "Calendar", href: "/calendar" }]
      : []),

    ...(canAccessRole(profile?.role, "reports")
      ? [{ label: "Reports", href: "/reports" }]
      : []),

    ...(canAccessRole(profile?.role, "settings")
      ? [{ label: "Settings", href: "/settings" }]
      : []),

      ...(canAccessRole(profile?.role, "userManagement")
  ? [{ label: "Users", href: "/settings/users" }]
  : []),

  ];

async function fetchNotifications() {
  if (!profile?.company_id) return;

  let query = supabase
    .from("tasks")
    .select("id, title, due_date, status, lead_id, assigned_user_id")
    .eq("company_id", profile.company_id)
    .neq("status", "Completed")
    .order("due_date", { ascending: true });

  if (profile.role === "Sales") {
    query = query.eq("assigned_user_id", profile.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading notifications:", error.message);
    setNotifications([]);
    return;
  }

  const now = new Date();

  const items: NotificationItem[] = (data || [])
    .map((task: any) => {
      const dueDate = task.due_date ? new Date(task.due_date) : null;

      if (!dueDate) return null;

      const isOverdue = dueDate < now;

      const isDueToday =
        dueDate.getDate() === now.getDate() &&
        dueDate.getMonth() === now.getMonth() &&
        dueDate.getFullYear() === now.getFullYear();

      if (!isOverdue && !isDueToday) return null;

      return {
        id: task.id,
        title: isOverdue ? "Overdue Task" : "Task Due Today",
        message: task.title,
        href: task.lead_id ? `/leads/${task.lead_id}` : "/tasks",
        severity: isOverdue ? "red" : "orange",
      };
    })
    .filter(Boolean) as NotificationItem[];

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
    router.push("/login");
  }

useEffect(() => {
  fetchBranding();
  fetchNotifications();

  function handleBrandingUpdated() {
    fetchBranding();
  }

  window.addEventListener("dealflow-branding-updated", handleBrandingUpdated);

  return () => {
    window.removeEventListener(
      "dealflow-branding-updated",
      handleBrandingUpdated
    );
  };
}, [profile?.company_id, profile?.role, profile?.id]);

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



<button
  onClick={async () => {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "27607592060",
        message: "Hello from DealFlow CRM 🚗",
      }),
    });

    const data = await response.json();
    console.log("WHATSAPP RESULT:", data);

    if (!response.ok) {
      alert("WhatsApp failed. Check browser console.");
      return;
    }

    alert("WhatsApp sent successfully.");
  }}
  className="rounded-xl bg-green-600 px-4 py-2 text-white"
>
  Test WhatsApp
</button>




          <button
            onClick={logout}
            className="mx-4 mb-4 rounded-xl px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>

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
    onClick={() => setShowNotifications(!showNotifications)}
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
    
    {/* HEADER */}
    <div className="border-b border-slate-100 px-6 py-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Notifications
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Tasks and follow-ups needing attention
          </p>
        </div>

        <div className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
          {notifications.length} New
        </div>
      </div>
    </div>

    {/* BODY */}
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
              key={`${notification.title}-${notification.id}`}
              href={notification.href}
              onClick={() => setShowNotifications(false)}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                
                {/* ICON */}
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                    notification.severity === "red"
                      ? "bg-red-100 text-red-600"
                      : notification.severity === "orange"
                      ? "bg-orange-100 text-orange-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {notification.severity === "red"
                    ? "⚠️"
                    : notification.severity === "orange"
                    ? "⏰"
                    : "🔔"}
                </div>

                {/* CONTENT */}
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
                      Open linked lead
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

    {/* FOOTER */}
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

              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                </div>

                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile?.role || "User"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}