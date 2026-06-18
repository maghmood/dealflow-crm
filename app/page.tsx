"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type Task = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  task_type: string | null;
  task_scope: string | null;
  lead_id: number | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  customer_name?: string | null;
};

type Lead = {
  id: number;
  status: string | null;
  source: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
};

type Deal = {
  id: number;
  lead_id: number | null;
  vehicle_id: number | null;
  deal_stage: string | null;
  assigned_user_id: number | null;
};

type FinanceApplication = {
  id: number;
  lead_id: number | null;
  finance_status: string | null;
};

type InventoryVehicle = {
  id: number;
  status: string | null;
};

function isSameDay(dateOne: Date, dateTwo: Date) {
  return (
    dateOne.getDate() === dateTwo.getDate() &&
    dateOne.getMonth() === dateTwo.getMonth() &&
    dateOne.getFullYear() === dateTwo.getFullYear()
  );
}

function isCompletedStatus(status: string | null) {
  return (status || "").toLowerCase() === "completed";
}

function isConvertedLeadStatus(status: string | null) {
  return [
    "sold",
    "delivered",
    "deal closed",
    "closed",
  ].includes((status || "").toLowerCase());
}

function isLostLeadStatus(status: string | null) {
  return ["lost", "cancelled"].includes(
    (status || "").toLowerCase()
  );
}

function isDeliveredDealStage(stage: string | null) {
  return (stage || "").toLowerCase() === "delivered";
}

function isActiveDealStage(stage: string | null) {
  return !["lost", "delivered"].includes(
    (stage || "").toLowerCase()
  );
}

function isFinanceApprovedLike(status: string | null) {
  return [
    "approved",
    "offers available",
    "offer selected",
    "paid out",
  ].includes((status || "").toLowerCase());
}

function isFinancePendingLike(status: string | null) {
  return [
    "submitted",
    "pending",
    "documents requested",
    "not submitted",
    "awaiting documents",
  ].includes((status || "").toLowerCase());
}

function isTaskOverdue(task: Task) {
  if (!task.due_date || isCompletedStatus(task.status)) return false;
  return new Date(task.due_date) < new Date();
}

function isTaskDueSoon(task: Task) {
  if (!task.due_date || isCompletedStatus(task.status)) return false;

  const now = new Date().getTime();
  const due = new Date(task.due_date).getTime();
  const oneHour = 60 * 60 * 1000;

  return due >= now && due <= now + oneHour;
}

function agendaCardStyle(task: Task) {
  if (isTaskOverdue(task)) {
    return "border-red-400 bg-red-50 text-red-950";
  }

  if (isTaskDueSoon(task)) {
    return "border-amber-400 bg-amber-50 text-amber-950";
  }

  const styles: Record<string, string> = {
    Followup: "border-purple-400 bg-purple-50 text-purple-950",
    "Follow-up": "border-purple-400 bg-purple-50 text-purple-950",
    Call: "border-green-400 bg-green-50 text-green-950",
    Callback: "border-green-400 bg-green-50 text-green-950",
    Finance: "border-indigo-400 bg-indigo-50 text-indigo-950",
    Delivery: "border-teal-400 bg-teal-50 text-teal-950",
    Meeting: "border-yellow-400 bg-yellow-50 text-yellow-950",
    "Test Drive": "border-orange-400 bg-orange-50 text-orange-950",
    Appointment: "border-cyan-400 bg-cyan-50 text-cyan-950",
  };

  return (
    styles[task.task_type || ""] ||
    "border-blue-400 bg-blue-50 text-blue-950"
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const { profile } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [financeApps, setFinanceApps] = useState<FinanceApplication[]>([]);
  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  async function fetchTasks() {
    if (!profile?.company_id) return;

    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, due_date, status, priority, task_type, task_scope, lead_id, assigned_user_id, assigned_user_name"
      )
      .eq("company_id", profile.company_id)
      .order("due_date", { ascending: true });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    if (profile.role === "Finance") {
      query = query
        .eq("assigned_user_id", profile.id)
        .eq("task_scope", "Finance");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading dashboard tasks:", error.message);
      setTasks([]);
      return;
    }

    const baseTasks = Array.isArray(data) ? (data as Task[]) : [];

    const leadIds = Array.from(
      new Set(
        baseTasks
          .map((task) => task.lead_id)
          .filter((leadId): leadId is number => Boolean(leadId))
      )
    );

    let customerMap = new Map<number, string>();

    if (leadIds.length > 0) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("id, customer")
        .eq("company_id", profile.company_id)
        .in("id", leadIds);

      if (leadError) {
        console.error(
          "Error loading dashboard task customers:",
          leadError.message
        );
      } else {
        customerMap = new Map(
          (leadData || []).map((lead: any) => [
            Number(lead.id),
            lead.customer || "Unknown Customer",
          ])
        );
      }
    }

    setTasks(
      baseTasks.map((task) => ({
        ...task,
        customer_name: task.lead_id
          ? customerMap.get(task.lead_id) || null
          : null,
      }))
    );
  }

  async function fetchDashboardData() {
    if (!profile?.company_id) return;

    /*
     * Finance users do not use the general sales dashboard.
     * They still see their Finance tasks and company finance application summary.
     */
    const shouldLoadSalesData = profile.role !== "Finance";

    let leadRows: Lead[] = [];

    if (shouldLoadSalesData) {
      let leadQuery = supabase
        .from("leads")
        .select(
          "id, status, source, assigned_user_id, assigned_user_name"
        )
        .eq("company_id", profile.company_id);

      if (profile.role === "Sales") {
        leadQuery = leadQuery.eq("assigned_user_id", profile.id);
      }

      const { data: leadData, error: leadError } = await leadQuery;

      if (leadError) {
        console.error("Error loading leads:", leadError.message);
        leadRows = [];
      } else {
        leadRows = Array.isArray(leadData) ? (leadData as Lead[]) : [];
      }

      setLeads(leadRows);
    } else {
      setLeads([]);
    }

    let financeQuery = supabase
      .from("finance_applications")
      .select("id, lead_id, finance_status")
      .eq("company_id", profile.company_id);

    if (profile.role === "Sales") {
      const leadIds = leadRows.map((lead) => lead.id);

      if (leadIds.length === 0) {
        setFinanceApps([]);
      } else {
        financeQuery = financeQuery.in("lead_id", leadIds);
      }
    }

    if (!(profile.role === "Sales" && leadRows.length === 0)) {
      const { data: financeData, error: financeError } =
        await financeQuery;

      if (financeError) {
        console.error(
          "Error loading finance applications:",
          financeError.message
        );
        setFinanceApps([]);
      } else {
        setFinanceApps(
          Array.isArray(financeData)
            ? (financeData as FinanceApplication[])
            : []
        );
      }
    }

    if (shouldLoadSalesData) {
      let dealQuery = supabase
        .from("deals")
        .select("id, lead_id, vehicle_id, deal_stage, assigned_user_id")
        .eq("company_id", profile.company_id);

      if (profile.role === "Sales") {
        dealQuery = dealQuery.eq("assigned_user_id", profile.id);
      }

      const { data: dealData, error: dealError } = await dealQuery;

      if (dealError) {
        console.error("Error loading deals:", dealError.message);
        setDeals([]);
      } else {
        setDeals(Array.isArray(dealData) ? (dealData as Deal[]) : []);
      }

      const { data: vehicleData, error: vehicleError } = await supabase
        .from("inventory_vehicles")
        .select("id, status")
        .eq("company_id", profile.company_id);

      if (vehicleError) {
        console.error(
          "Error loading inventory summary:",
          vehicleError.message
        );
        setVehicles([]);
      } else {
        setVehicles(
          Array.isArray(vehicleData)
            ? (vehicleData as InventoryVehicle[])
            : []
        );
      }
    } else {
      setDeals([]);
      setVehicles([]);
    }
  }

  useEffect(() => {
    if (!profile?.company_id) return;

    void fetchTasks();
    void fetchDashboardData();

    function handleTaskUpdated() {
      void fetchTasks();
      void fetchDashboardData();
    }

    window.addEventListener(
      "dealflow-task-updated",
      handleTaskUpdated
    );

    return () => {
      window.removeEventListener(
        "dealflow-task-updated",
        handleTaskUpdated
      );
    };
  }, [profile?.company_id, profile?.role, profile?.id]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !isCompletedStatus(task.status)),
    [tasks]
  );

  const overdueTasks = useMemo(
    () => tasks.filter((task) => isTaskOverdue(task)),
    [tasks]
  );

  const dueTodayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.due_date || isCompletedStatus(task.status)) return false;
        return isSameDay(new Date(task.due_date), new Date());
      }),
    [tasks]
  );

  const agendaTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (!task.due_date || isCompletedStatus(task.status)) return false;

          const dueDate = new Date(task.due_date);

          return (
            dueDate < new Date() ||
            isSameDay(dueDate, new Date())
          );
        })
        .sort((a, b) => {
          const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
          return aTime - bTime;
        })
        .slice(0, 6),
    [tasks]
  );

  const upcomingTasks = useMemo(
    () =>
      openTasks
        .slice()
        .sort((a, b) => {
          const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
          return aTime - bTime;
        })
        .slice(0, 5),
    [openTasks]
  );

  const totalLeads = leads.length;

  const deliveredDealLeadIds = new Set(
    deals
      .filter((deal) => isDeliveredDealStage(deal.deal_stage))
      .map((deal) => deal.lead_id)
      .filter((leadId): leadId is number => Boolean(leadId))
  );

  const convertedLeadIds = new Set<number>();

  leads.forEach((lead) => {
    if (isConvertedLeadStatus(lead.status)) {
      convertedLeadIds.add(lead.id);
    }
  });

  deliveredDealLeadIds.forEach((leadId) => {
    convertedLeadIds.add(leadId);
  });

  const convertedLeads = convertedLeadIds.size;

  const activeLeadBase = leads.filter(
    (lead) => !isLostLeadStatus(lead.status)
  ).length;

  const conversionRate =
    activeLeadBase > 0
      ? Math.round((convertedLeads / activeLeadBase) * 100)
      : 0;

  const deliveredDeals = deals.filter((deal) =>
    isDeliveredDealStage(deal.deal_stage)
  ).length;

  const salePendingDeals = deals.filter(
    (deal) => deal.deal_stage === "Sale Pending"
  ).length;

  const activeDeals = deals.filter((deal) =>
    isActiveDealStage(deal.deal_stage)
  ).length;

  const approvedFinance = financeApps.filter((app) =>
    isFinanceApprovedLike(app.finance_status)
  ).length;

  const pendingFinance = financeApps.filter((app) =>
    isFinancePendingLike(app.finance_status)
  ).length;

  const declinedFinance = financeApps.filter(
    (app) => (app.finance_status || "").toLowerCase() === "declined"
  ).length;

  const vehiclesByStatus = Object.entries(
    vehicles.reduce((acc: Record<string, number>, vehicle) => {
      const status = vehicle.status || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({
    status,
    count,
  }));

  const leadsByStatus = Object.entries(
    leads.reduce((acc: Record<string, number>, lead) => {
      const status = lead.status || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({
    status,
    count,
  }));

  const leadsBySource = Object.entries(
    leads.reduce((acc: Record<string, number>, lead) => {
      const source = lead.source || "Not Captured";
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([source, count]) => ({
      source,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const salespeople = Object.entries(
    leads.reduce(
      (acc: Record<string, { leads: number; closed: number }>, lead) => {
        const user = lead.assigned_user_name || "Unassigned";

        if (!acc[user]) {
          acc[user] = {
            leads: 0,
            closed: 0,
          };
        }

        acc[user].leads += 1;

        if (
          isConvertedLeadStatus(lead.status) ||
          deliveredDealLeadIds.has(lead.id)
        ) {
          acc[user].closed += 1;
        }

        return acc;
      },
      {}
    )
  ).map(([name, stats]) => ({
    name,
    leads: stats.leads,
    closed: stats.closed,
  }));

  const maxStatusCount =
    leadsByStatus.length > 0
      ? Math.max(...leadsByStatus.map((item) => item.count))
      : 1;

  const maxSourceCount =
    leadsBySource.length > 0
      ? Math.max(...leadsBySource.map((item) => item.count))
      : 1;

  const maxVehicleStatusCount =
    vehiclesByStatus.length > 0
      ? Math.max(...vehiclesByStatus.map((item) => item.count))
      : 1;

  const maxSalesLeads =
    salespeople.length > 0
      ? Math.max(...salespeople.map((item) => item.leads))
      : 1;

  const isFinanceDashboard = profile?.role === "Finance";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* KPI CARDS */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">
              {isFinanceDashboard ? "Finance Tasks" : "Total Leads"}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {isFinanceDashboard ? openTasks.length : totalLeads}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isFinanceDashboard
                ? "Open Finance work assigned to you"
                : "Company leads in the current view"}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">
              Conversion Rate
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {isFinanceDashboard ? "-" : `${conversionRate}%`}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sold/Delivered customers vs active leads
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">
              Finance Progress
            </p>
            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {approvedFinance}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {pendingFinance} pending • {declinedFinance} declined
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Open Tasks</p>
            <h2 className="mt-2 text-3xl font-bold text-orange-700">
              {openTasks.length}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {overdueTasks.length} overdue • {dueTodayTasks.length} due today
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">
              Delivered Deals
            </p>
            <h2 className="mt-2 text-3xl font-bold text-emerald-700">
              {isFinanceDashboard ? "-" : deliveredDeals}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isFinanceDashboard
                ? "Sales delivery metrics hidden"
                : `${salePendingDeals} sale pending • ${activeDeals} active`}
            </p>
          </div>
        </div>

        {/* TODAY'S AGENDA */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                Today’s Agenda
              </h2>
              <p className="text-sm text-slate-500">
                Open tasks due today plus overdue work that still needs action
              </p>
            </div>

            <Link
              href="/calendar"
              className="rounded-lg brand-primary-bg px-4 py-2 text-sm font-semibold text-white"
            >
              Open Calendar
            </Link>
          </div>

          {agendaTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No open agenda items for today.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {agendaTasks.map((task) => {
                const overdue = isTaskOverdue(task);
                const dueSoon = isTaskDueSoon(task);

                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border-l-4 p-4 shadow-sm ${agendaCardStyle(
                      task
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">
                          {task.title || "Untitled Task"}
                        </p>

                        <p className="mt-1 text-sm font-bold text-blue-800">
                          {task.customer_name || "General / Unlinked"}
                        </p>

                        <p className="mt-1 text-sm opacity-80">
                          {task.task_type || "Task"} •{" "}
                          {task.assigned_user_name || "Unassigned"}
                        </p>
                      </div>

                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                        {formatDateTime(task.due_date)}
                      </span>
                    </div>

                    {task.description && (
                      <p className="mt-3 line-clamp-2 text-sm opacity-80">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {dueSoon && (
                          <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                            Due soon
                          </span>
                        )}

                        {overdue && (
                          <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-bold text-red-900">
                            Overdue
                          </span>
                        )}

                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                          {task.priority || "Medium"}
                        </span>
                      </div>

                      <Link
                        href={`/tasks?taskId=${task.id}`}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                      >
                        Open Task
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TASK WIDGETS */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  My Open Tasks
                </h2>
                <p className="text-sm text-slate-500">
                  Upcoming follow-ups, callbacks and operational actions
                </p>
              </div>

              <Link
                href="/tasks"
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                View all tasks
              </Link>
            </div>

            <div className="space-y-4">
              {upcomingTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No open tasks assigned.
                </div>
              ) : (
                upcomingTasks.map((task) => {
                  const isOverdue = isTaskOverdue(task);

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-4 ${
                        isOverdue
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {task.title}
                          </h3>

                          <p className="mt-1 text-sm font-medium text-blue-700">
                            {task.customer_name || "General / Unlinked"}
                          </p>

                          {task.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                              {task.priority || "Medium"}
                            </span>

                            {task.task_type && (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                                {task.task_type}
                              </span>
                            )}

                            {task.due_date && (
                              <span
                                className={
                                  isOverdue
                                    ? "font-medium text-red-600"
                                    : "text-slate-500"
                                }
                              >
                                Due: {formatDateTime(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/tasks?taskId=${task.id}`}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                        >
                          Open Task
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold text-slate-800">
              Task Summary
            </h2>

            <p className="text-sm text-slate-500">
              Open work only, excluding completed tasks
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-sm text-orange-700">Open Tasks</p>
                <p className="mt-1 text-3xl font-bold text-orange-800">
                  {openTasks.length}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-700">Overdue</p>
                <p className="mt-1 text-3xl font-bold text-red-800">
                  {overdueTasks.length}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Due Today</p>
                <p className="mt-1 text-3xl font-bold text-blue-800">
                  {dueTodayTasks.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isFinanceDashboard && (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEADS BY STATUS */}
              <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Leads by Status
                  </h2>
                  <p className="text-sm text-slate-500">
                    Current dealership pipeline overview
                  </p>
                </div>

                <div className="space-y-4">
                  {leadsByStatus.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      No leads found.
                    </div>
                  ) : (
                    leadsByStatus.map((item) => (
                      <div key={item.status}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {item.status}
                          </span>
                          <span className="text-slate-500">{item.count}</span>
                        </div>

                        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full brand-primary-bg"
                            style={{
                              width: `${(item.count / maxStatusCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FINANCE SNAPSHOT */}
              <div className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-2xl font-bold text-slate-800">
                  Finance Snapshot
                </h2>

                <p className="text-sm text-slate-500">
                  Application status summary
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl bg-green-50 p-4">
                    <p className="text-sm text-green-700">
                      Approved / Offers
                    </p>
                    <p className="mt-1 text-3xl font-bold text-green-800">
                      {approvedFinance}
                    </p>
                  </div>

                  <div className="rounded-xl bg-orange-50 p-4">
                    <p className="text-sm text-orange-700">Pending</p>
                    <p className="mt-1 text-3xl font-bold text-orange-800">
                      {pendingFinance}
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-sm text-red-700">Declined</p>
                    <p className="mt-1 text-3xl font-bold text-red-800">
                      {declinedFinance}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEAD SOURCE */}
              <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Lead Sources
                  </h2>
                  <p className="text-sm text-slate-500">
                    Where dealership leads are coming from
                  </p>
                </div>

                <div className="space-y-4">
                  {leadsBySource.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      No lead source data captured yet.
                    </div>
                  ) : (
                    leadsBySource.map((item) => (
                      <div key={item.source}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {item.source}
                          </span>
                          <span className="text-slate-500">{item.count}</span>
                        </div>

                        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full brand-accent-bg"
                            style={{
                              width: `${(item.count / maxSourceCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* INVENTORY SNAPSHOT */}
              <div className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-2xl font-bold text-slate-800">
                  Inventory Snapshot
                </h2>

                <p className="text-sm text-slate-500">
                  Vehicle status overview
                </p>

                <div className="mt-6 space-y-4">
                  {vehiclesByStatus.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No inventory data found.
                    </div>
                  ) : (
                    vehiclesByStatus.map((item) => (
                      <div key={item.status}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {item.status}
                          </span>
                          <span className="text-slate-500">{item.count}</span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full brand-primary-bg"
                            style={{
                              width: `${
                                (item.count / maxVehicleStatusCount) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* SALESPERSON PERFORMANCE */}
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  Salesperson Performance
                </h2>
                <p className="text-sm text-slate-500">
                  Lead volume and Sold/Delivered conversion by salesperson
                </p>
              </div>

              <div className="space-y-5">
                {salespeople.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No salesperson performance data yet.
                  </div>
                ) : (
                  salespeople.map((person) => (
                    <div key={person.name}>
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {person.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {person.closed} sold/delivered from {person.leads} leads
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                          {person.leads > 0
                            ? Math.round(
                                (person.closed / person.leads) * 100
                              )
                            : 0}
                          % conversion
                        </span>
                      </div>

                      <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full brand-accent-bg"
                          style={{
                            width: `${(person.leads / maxSalesLeads) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
