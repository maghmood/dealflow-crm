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
  lead_id: number | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
};

type Lead = {
  id: number;
  status: string | null;
  assigned_user_name: string | null;
};

type FinanceApplication = {
  id: number;
  finance_status: string | null;
};

function isSameDay(dateOne: Date, dateTwo: Date) {
  return (
    dateOne.getDate() === dateTwo.getDate() &&
    dateOne.getMonth() === dateTwo.getMonth() &&
    dateOne.getFullYear() === dateTwo.getFullYear()
  );
}

function isTaskOverdue(task: Task) {
  if (!task.due_date || task.status === "Completed") return false;
  return new Date(task.due_date) < new Date();
}

function isTaskDueSoon(task: Task) {
  if (!task.due_date || task.status === "Completed") return false;

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
    Finance: "border-indigo-400 bg-indigo-50 text-indigo-950",
    Delivery: "border-teal-400 bg-teal-50 text-teal-950",
    Meeting: "border-yellow-400 bg-yellow-50 text-yellow-950",
    "Test Drive": "border-orange-400 bg-orange-50 text-orange-950",
    Appointment: "border-cyan-400 bg-cyan-50 text-cyan-950",
  };

  return styles[task.task_type || ""] || "border-blue-400 bg-blue-50 text-blue-950";
}

export default function Home() {
  const { profile } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [financeApps, setFinanceApps] = useState<FinanceApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  async function fetchTasks() {
    if (!profile?.company_id) return;

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("due_date", { ascending: true });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading dashboard tasks:", error.message);
      setTasks([]);
      return;
    }

    setTasks(Array.isArray(data) ? data : []);
  }

  async function fetchDashboardData() {
    if (!profile?.company_id) return;

    let leadQuery = supabase
      .from("leads")
      .select("id, status, assigned_user_name, assigned_user_id")
      .eq("company_id", profile.company_id);

    if (profile.role === "Sales") {
      leadQuery = leadQuery.eq("assigned_user_id", profile.id);
    }

    const { data: leadData, error: leadError } = await leadQuery;

    if (leadError) {
      console.error("Error loading leads:", leadError.message);
      setLeads([]);
    } else {
      setLeads(Array.isArray(leadData) ? leadData : []);
    }

    const { data: financeData, error: financeError } = await supabase
      .from("finance_applications")
      .select("id, finance_status")
      .eq("company_id", profile.company_id);

    if (financeError) {
      console.error(
        "Error loading finance applications:",
        financeError.message
      );
      setFinanceApps([]);
    } else {
      setFinanceApps(Array.isArray(financeData) ? financeData : []);
    }
  }

  useEffect(() => {
    fetchTasks();
    fetchDashboardData();
  }, [profile?.company_id, profile?.role, profile?.id]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Completed"),
    [tasks]
  );

  const overdueTasks = useMemo(
    () => tasks.filter((task) => isTaskOverdue(task)),
    [tasks]
  );

  const dueTodayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.due_date || task.status === "Completed") return false;
        return isSameDay(new Date(task.due_date), new Date());
      }),
    [tasks]
  );

  const agendaTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (!task.due_date || task.status === "Completed") return false;
          return isSameDay(new Date(task.due_date), new Date());
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
    () => tasks.filter((task) => task.status !== "Completed").slice(0, 5),
    [tasks]
  );

  const totalLeads = leads.length;

  const closedLeads = leads.filter(
    (lead) => lead.status === "Closed" || lead.status === "Delivered"
  ).length;

  const conversionRate =
    totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  const approvedFinance = financeApps.filter(
    (app) => app.finance_status === "Approved"
  ).length;

  const pendingFinance = financeApps.filter(
    (app) =>
      app.finance_status === "Submitted" ||
      app.finance_status === "Pending"
  ).length;

  const declinedFinance = financeApps.filter(
    (app) => app.finance_status === "Declined"
  ).length;

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

        if (lead.status === "Closed" || lead.status === "Delivered") {
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

  const maxSalesLeads =
    salespeople.length > 0
      ? Math.max(...salespeople.map((item) => item.leads))
      : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* KPI CARDS */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Total Leads</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {totalLeads}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Active dealership leads
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Conversion Rate</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {conversionRate}%
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Closed vs total leads
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Finance Approvals</p>
            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {approvedFinance}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {pendingFinance} pending
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Overdue Tasks</p>
            <h2 className="mt-2 text-3xl font-bold text-red-600">
              {overdueTasks.length}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Needs immediate attention
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
                Scheduled appointments, test drives, calls and follow-ups due today
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

                        <p className="mt-1 text-sm opacity-80">
                          {task.task_type || "Task"} •{" "}
                          {task.assigned_user_name || "Unassigned"}
                        </p>
                      </div>

                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleTimeString(
                              "en-ZA",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "-"}
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

                      {task.lead_id ? (
                        <Link
                          href={`/leads/${task.lead_id}`}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                        >
                          Open Lead
                        </Link>
                      ) : (
                        <Link
                          href="/tasks"
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                        >
                          Open Task
                        </Link>
                      )}
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
                  Upcoming follow-ups and callbacks
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
                  const isOverdue =
                    task.due_date && new Date(task.due_date) < new Date();

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

                          {task.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                              {task.priority || "Medium"}
                            </span>

                            {task.due_date && (
                              <span
                                className={
                                  isOverdue
                                    ? "font-medium text-red-600"
                                    : "text-slate-500"
                                }
                              >
                                Due:{" "}
                                {new Date(task.due_date).toLocaleString(
                                  "en-ZA"
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {task.lead_id && (
                          <Link
                            href={`/leads/${task.lead_id}`}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                          >
                            Open Lead
                          </Link>
                        )}
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
              Operational follow-up overview
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
                <p className="text-sm text-green-700">Approved</p>
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

        {/* SALESPERSON PERFORMANCE */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Salesperson Performance
            </h2>
            <p className="text-sm text-slate-500">
              Lead volume and closed deals by agent
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
                        {person.closed} closed from {person.leads} leads
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                      {person.leads > 0
                        ? Math.round((person.closed / person.leads) * 100)
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
      </div>
    </DashboardLayout>
  );
}
