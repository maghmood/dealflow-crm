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
  created_at: string | null;
  customer_name?: string | null;
};

type Lead = {
  id: number;
  customer: string | null;
  status: string | null;
  source: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  last_contacted_at: string | null;
  last_contact_method: string | null;
  last_contact_outcome: string | null;
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

type CommunicationLog = {
  id: number;
  lead_id: number;
  deal_id: number | null;
  channel: string;
  send_status: string | null;
  outcome: string | null;
  summary: string | null;
  customer_name: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
  created_at: string;
  sent_at: string | null;
  resolved_at: string | null;
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

function isCommunicationFollowUpTask(task: Task) {
  const reasonLike = [
    "WHATSAPP_FOLLOW_UP",
    "EMAIL_FOLLOW_UP",
    "COMMUNICATION_FOLLOW_UP",
    "CUSTOMER_FOLLOW_UP",
  ];

  const searchable = `${task.title || ""} ${task.task_type || ""} ${
    task.description || ""
  }`.toLowerCase();

  return (
    reasonLike.some((reason) =>
      searchable.includes(reason.toLowerCase())
    ) ||
    searchable.includes("whatsapp") ||
    searchable.includes("email") ||
    searchable.includes("communication")
  );
}

function isPendingCommunication(log: CommunicationLog) {
  const status = log.send_status || "Pending Outcome";

  return (
    !log.resolved_at &&
    ["Pending Outcome", "Sent Manually", "Follow-up Created"].includes(status)
  );
}

function isActiveLeadForContact(lead: Lead) {
  return !isLostLeadStatus(lead.status) && !isConvertedLeadStatus(lead.status);
}

function isOlderThanDays(value: string | null | undefined, days: number) {
  if (!value) return true;

  const ageMs = new Date().getTime() - new Date(value).getTime();
  return ageMs > days * 24 * 60 * 60 * 1000;
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
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);

  async function fetchTasks() {
    if (!profile?.company_id) return;

    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, due_date, status, priority, task_type, task_scope, lead_id, assigned_user_id, assigned_user_name, created_at"
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


  async function fetchCommunicationLogs() {
    if (!profile?.company_id) return;

    if (profile.role === "Finance") {
      setCommunicationLogs([]);
      return;
    }

    let query = supabase
      .from("communication_logs")
      .select(
        "id, lead_id, deal_id, channel, send_status, outcome, summary, customer_name, created_by_id, created_by_name, created_at, sent_at, resolved_at"
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (profile.role === "Sales") {
      query = query.eq("created_by_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Error loading communication accountability:",
        error.message
      );
      setCommunicationLogs([]);
      return;
    }

    setCommunicationLogs(
      Array.isArray(data) ? (data as CommunicationLog[]) : []
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
          "id, customer, status, source, assigned_user_id, assigned_user_name, last_contacted_at, last_contact_method, last_contact_outcome"
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
    void fetchCommunicationLogs();

    function handleTaskUpdated() {
      void fetchTasks();
      void fetchDashboardData();
      void fetchCommunicationLogs();
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


  const pendingCommunicationLogs = useMemo(
    () => communicationLogs.filter((log) => isPendingCommunication(log)),
    [communicationLogs]
  );

  const communicationLogsToday = useMemo(
    () =>
      communicationLogs.filter((log) =>
        isSameDay(new Date(log.created_at), new Date())
      ),
    [communicationLogs]
  );

  const contactedTodayLeadIds = new Set(
    communicationLogsToday.map((log) => log.lead_id)
  );

  const communicationFollowUpTasks = useMemo(
    () =>
      openTasks.filter((task) => isCommunicationFollowUpTask(task)),
    [openTasks]
  );

  const overdueCommunicationFollowUps = useMemo(
    () =>
      communicationFollowUpTasks.filter((task) => isTaskOverdue(task)),
    [communicationFollowUpTasks]
  );

  const leadsNotContacted = useMemo(
    () =>
      leads.filter(
        (lead) =>
          isActiveLeadForContact(lead) &&
          isOlderThanDays(lead.last_contacted_at, 2)
      ),
    [leads]
  );

  const openWhatsAppFollowUps = communicationFollowUpTasks.filter((task) =>
    `${task.title || ""} ${task.description || ""} ${task.task_type || ""}`
      .toLowerCase()
      .includes("whatsapp")
  ).length;

  const openEmailFollowUps = communicationFollowUpTasks.filter((task) =>
    `${task.title || ""} ${task.description || ""} ${task.task_type || ""}`
      .toLowerCase()
      .includes("email")
  ).length;

  const communicationByUser = useMemo(() => {
    const map = new Map<
      string,
      {
        userName: string;
        pending: number;
        overdueFollowUps: number;
        contactedToday: number;
        notContacted: number;
      }
    >();

    function ensureUser(userName: string) {
      if (!map.has(userName)) {
        map.set(userName, {
          userName,
          pending: 0,
          overdueFollowUps: 0,
          contactedToday: 0,
          notContacted: 0,
        });
      }

      return map.get(userName)!;
    }

    leads.forEach((lead) => {
      const userName = lead.assigned_user_name || "Unassigned";
      const row = ensureUser(userName);

      if (
        isActiveLeadForContact(lead) &&
        isOlderThanDays(lead.last_contacted_at, 2)
      ) {
        row.notContacted += 1;
      }
    });

    pendingCommunicationLogs.forEach((log) => {
      const userName = log.created_by_name || "Unknown User";
      ensureUser(userName).pending += 1;
    });

    overdueCommunicationFollowUps.forEach((task) => {
      const userName = task.assigned_user_name || "Unassigned";
      ensureUser(userName).overdueFollowUps += 1;
    });

    communicationLogsToday.forEach((log) => {
      const userName = log.created_by_name || "Unknown User";
      ensureUser(userName).contactedToday += 1;
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        b.pending +
        b.overdueFollowUps +
        b.notContacted -
        (a.pending + a.overdueFollowUps + a.notContacted)
    );
  }, [
    leads,
    pendingCommunicationLogs,
    overdueCommunicationFollowUps,
    communicationLogsToday,
  ]);

  const atRiskCommunicationItems = useMemo(() => {
    const pendingItems = pendingCommunicationLogs.slice(0, 4).map((log) => ({
      id: `pending-${log.id}`,
      label: "Pending outcome",
      customer: log.customer_name || `Lead #${log.lead_id}`,
      detail: `${log.channel} action by ${log.created_by_name || "user"} has not been resolved.`,
      href: `/leads/${log.lead_id}`,
      severity: "orange",
      date: log.created_at,
    }));

    const overdueItems = overdueCommunicationFollowUps.slice(0, 4).map((task) => ({
      id: `task-${task.id}`,
      label: "Overdue follow-up",
      customer: task.customer_name || `Lead #${task.lead_id}`,
      detail: `${task.title} assigned to ${task.assigned_user_name || "user"}.`,
      href: `/tasks?taskId=${task.id}`,
      severity: "red",
      date: task.due_date || task.created_at || "",
    }));

    const noContactItems = leadsNotContacted.slice(0, 4).map((lead) => ({
      id: `no-contact-${lead.id}`,
      label: "No recent contact",
      customer: lead.customer || `Lead #${lead.id}`,
      detail: lead.last_contacted_at
        ? `Last contacted ${formatDateTime(lead.last_contacted_at)} via ${
            lead.last_contact_method || "unknown"
          }.`
        : "No contact has been logged yet.",
      href: `/leads/${lead.id}`,
      severity: "blue",
      date: lead.last_contacted_at || "",
    }));

    return [...overdueItems, ...pendingItems, ...noContactItems].slice(0, 8);
  }, [
    pendingCommunicationLogs,
    overdueCommunicationFollowUps,
    leadsNotContacted,
  ]);

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
      <div className="space-y-8">

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-1 brand-primary-bg" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Dealership Command Centre
                </p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                  {isFinanceDashboard
                    ? "Finance workspace"
                    : "Sales, tasks and communication overview"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 md:text-base">
                  Monitor the work that needs attention, track customer communication outcomes,
                  and keep every lead moving through the dealership workflow.
                </p>
              </div>

              <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Open work
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">
                    {openTasks.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    Pending outcomes
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-orange-800">
                    {isFinanceDashboard ? "-" : pendingCommunicationLogs.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Overdue
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-red-800">
                    {overdueTasks.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPI CARDS */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm leading-6 text-slate-500">
              {isFinanceDashboard ? "Finance Tasks" : "Total Leads"}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
              {isFinanceDashboard ? openTasks.length : totalLeads}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isFinanceDashboard
                ? "Open Finance work assigned to you"
                : "Company leads in the current view"}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm leading-6 text-slate-500">
              Conversion Rate
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
              {isFinanceDashboard ? "-" : `${conversionRate}%`}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sold/Delivered customers vs active leads
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm leading-6 text-slate-500">
              Finance Progress
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-green-700">
              {approvedFinance}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {pendingFinance} pending • {declinedFinance} declined
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm leading-6 text-slate-500">Open Tasks</p>
            <h2 className="mt-2 text-3xl font-extrabold text-orange-700">
              {openTasks.length}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {overdueTasks.length} overdue • {dueTodayTasks.length} due today
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm leading-6 text-slate-500">
              Delivered Deals
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-emerald-700">
              {isFinanceDashboard ? "-" : deliveredDeals}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isFinanceDashboard
                ? "Sales delivery metrics hidden"
                : `${salePendingDeals} sale pending • ${activeDeals} active`}
            </p>
          </div>
        </div>

        {/* TODAY'S AGENDA */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                Today’s Agenda
              </h2>
              <p className="text-sm leading-6 text-slate-500">
                Open tasks due today plus overdue work that still needs action
              </p>
            </div>

            <Link
              href="/calendar"
              className="rounded-xl brand-primary-bg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Open Calendar
            </Link>
          </div>

          {agendaTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
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
                    className={`rounded-2xl border-l-4 p-4 shadow-sm ${agendaCardStyle(
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
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  My Open Tasks
                </h2>
                <p className="text-sm leading-6 text-slate-500">
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
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                  No open tasks assigned.
                </div>
              ) : (
                upcomingTasks.map((task) => {
                  const isOverdue = isTaskOverdue(task);

                  return (
                    <div
                      key={task.id}
                      className={`rounded-2xl border p-4 ${
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
                            <p className="mt-1 text-sm leading-6 text-slate-500">
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
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
              Task Summary
            </h2>

            <p className="text-sm leading-6 text-slate-500">
              Open work only, excluding completed tasks
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-sm text-orange-700">Open Tasks</p>
                <p className="mt-1 text-3xl font-extrabold text-orange-800">
                  {openTasks.length}
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-700">Overdue</p>
                <p className="mt-1 text-3xl font-extrabold text-red-800">
                  {overdueTasks.length}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Due Today</p>
                <p className="mt-1 text-3xl font-extrabold text-blue-800">
                  {dueTodayTasks.length}
                </p>
              </div>
            </div>
          </div>
        </div>


        {!isFinanceDashboard && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  Communication Accountability
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  Pending outcomes, overdue communication follow-ups and leads needing contact
                </p>
              </div>

              <Link
                href="/tasks"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Open Tasks
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <CommunicationMetric
                label="Pending Outcomes"
                value={pendingCommunicationLogs.length}
                tone="orange"
              />
              <CommunicationMetric
                label="Overdue Follow-ups"
                value={overdueCommunicationFollowUps.length}
                tone="red"
              />
              <CommunicationMetric
                label="No Contact 2+ Days"
                value={leadsNotContacted.length}
                tone="blue"
              />
              <CommunicationMetric
                label="Contacted Today"
                value={contactedTodayLeadIds.size}
                tone="green"
              />
              <CommunicationMetric
                label="WhatsApp Follow-ups"
                value={openWhatsAppFollowUps}
                tone="purple"
              />
              <CommunicationMetric
                label="Email Follow-ups"
                value={openEmailFollowUps}
                tone="slate"
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">
                  By Salesperson
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  Use this for daily accountability check-ins.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-3 pr-3">User</th>
                        <th className="py-3 pr-3">Pending</th>
                        <th className="py-3 pr-3">Overdue</th>
                        <th className="py-3 pr-3">Contacted Today</th>
                        <th className="py-3 pr-3">No Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communicationByUser.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-center text-slate-500"
                          >
                            No communication activity captured yet.
                          </td>
                        </tr>
                      ) : (
                        communicationByUser.map((row) => (
                          <tr
                            key={row.userName}
                            className="border-b border-slate-200 last:border-0"
                          >
                            <td className="py-3 pr-3 font-semibold text-slate-800">
                              {row.userName}
                            </td>
                            <td className="py-3 pr-3 text-orange-700">
                              {row.pending}
                            </td>
                            <td className="py-3 pr-3 text-red-700">
                              {row.overdueFollowUps}
                            </td>
                            <td className="py-3 pr-3 text-green-700">
                              {row.contactedToday}
                            </td>
                            <td className="py-3 pr-3 text-blue-700">
                              {row.notContacted}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">
                  At Risk Communication
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  Items that need manager or salesperson attention.
                </p>

                <div className="mt-4 space-y-3">
                  {atRiskCommunicationItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                      No communication risk items right now.
                    </div>
                  ) : (
                    atRiskCommunicationItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-200 hover:bg-blue-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {item.customer}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.detail}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              item.severity === "red"
                                ? "bg-red-100 text-red-700"
                                : item.severity === "orange"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isFinanceDashboard && (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEADS BY STATUS */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-6">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                    Leads by Status
                  </h2>
                  <p className="text-sm leading-6 text-slate-500">
                    Current dealership pipeline overview
                  </p>
                </div>

                <div className="space-y-4">
                  {leadsByStatus.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
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
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  Finance Snapshot
                </h2>

                <p className="text-sm leading-6 text-slate-500">
                  Application status summary
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-sm text-green-700">
                      Approved / Offers
                    </p>
                    <p className="mt-1 text-3xl font-extrabold text-green-800">
                      {approvedFinance}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <p className="text-sm text-orange-700">Pending</p>
                    <p className="mt-1 text-3xl font-extrabold text-orange-800">
                      {pendingFinance}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm text-red-700">Declined</p>
                    <p className="mt-1 text-3xl font-extrabold text-red-800">
                      {declinedFinance}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEAD SOURCE */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-6">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                    Lead Sources
                  </h2>
                  <p className="text-sm leading-6 text-slate-500">
                    Where dealership leads are coming from
                  </p>
                </div>

                <div className="space-y-4">
                  {leadsBySource.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
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
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  Inventory Snapshot
                </h2>

                <p className="text-sm leading-6 text-slate-500">
                  Vehicle status overview
                </p>

                <div className="mt-6 space-y-4">
                  {vehiclesByStatus.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  Salesperson Performance
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  Lead volume and Sold/Delivered conversion by salesperson
                </p>
              </div>

              <div className="space-y-5">
                {salespeople.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
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

                          <p className="text-sm leading-6 text-slate-500">
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


function CommunicationMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "orange" | "red" | "blue" | "green" | "purple" | "slate";
}) {
  const styles: Record<
    typeof tone,
    {
      box: string;
      text: string;
    }
  > = {
    orange: {
      box: "bg-orange-50",
      text: "text-orange-800",
    },
    red: {
      box: "bg-red-50",
      text: "text-red-800",
    },
    blue: {
      box: "bg-blue-50",
      text: "text-blue-800",
    },
    green: {
      box: "bg-green-50",
      text: "text-green-800",
    },
    purple: {
      box: "bg-purple-50",
      text: "text-purple-800",
    },
    slate: {
      box: "bg-slate-50",
      text: "text-slate-800",
    },
  };

  return (
    <div className={`rounded-2xl border border-white/70 p-4 shadow-sm ${styles[tone].box}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-extrabold ${styles[tone].text}`}>
        {value}
      </p>
    </div>
  );
}
