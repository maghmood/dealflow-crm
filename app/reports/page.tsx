"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";


type Lead = {
  id: number;
  customer: string | null;
  status: string | null;
  finance: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  created_at: string | null;
};

type Deal = {
  id: number;
  customer_name: string | null;
  vehicle_name: string | null;
  deal_stage: string | null;
  finance_status: string | null;
  sale_price: number | null;
  deposit_amount: number | null;
  trade_in_value: number | null;
  settlement_amount: number | null;
  extras_amount: number | null;
  discount_amount: number | null;
  assigned_user_id: number | null;
  created_at: string | null;
};

type InventoryVehicle = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  status: string | null;
  price: number | null;
  created_at: string | null;
};

type FinanceApplication = {
  id: number;
  lead_id: number | null;
  customer: string | null;
  vehicle: string | null;
  requested_amount: number | null;
  deposit: number | null;
  finance_status: string | null;
  bank: string | null;
  submitted_at: string | null;
};

type Task = {
  id: number;
  title: string | null;
  status: string | null;
  due_date: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  lead_id: number | null;
};

type DocumentItem = {
  id: number;
  lead_id: number | null;
  deal_id: number | null;
  vehicle_id: number | null;
  status: string | null;
  document_type: string | null;
  created_at: string | null;
};

type CallLog = {
  id: number;
  company_id: number;
  lead_id: number;
  user_profile_id: number | null;
  user_name: string | null;
  phone_number: string | null;
  direction: "Outbound" | "Inbound";
  outcome: string;
  notes: string | null;
  called_at: string;
  duration_seconds: number | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_task_id: number | null;
  created_at: string;
};


type AffordabilityAssessment = {
  id: number;
  company_id: number;
  lead_id: number;
  created_by_id: number | null;
  created_by_name: string | null;
  target_monthly_installment: number;
  deposit_amount: number;
  interest_rate: number;
  term_months: number;
  balloon_percentage: number;
  maximum_vehicle_price: number;
  selected_vehicle_id: number | null;
  selected_vehicle_price: number | null;
  estimated_installment: number | null;
  notes: string | null;
  created_at: string;
};

type WhatsAppConversationReport = {
  id: number;
  company_id: number;
  lead_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count: number;
  waiting_for_response: boolean;
  status: "Open" | "Closed" | "Archived";
  is_unmatched: boolean;
  created_at: string;
};

type WhatsAppMessageReport = {
  id: number;
  company_id: number;
  lead_id: number | null;
  conversation_id: number | null;
  direction: "Inbound" | "Outbound";
  sender_name: string | null;
  message: string;
  delivery_status:
    | "Pending"
    | "Sent"
    | "Delivered"
    | "Read"
    | "Failed"
    | "Received"
    | null;
  created_at: string;
};

type WhatsAppResponseCycle = {
  inbound_message_id: number;
  company_id: number;
  lead_id: number | null;
  conversation_id: number;
  inbound_message: string | null;
  inbound_at: string;
  response_message_id: number | null;
  responder_name: string | null;
  responded_at: string | null;
  response_minutes: number | null;
};

type StatusBucket = {
  label: string;
  count: number;
};

type SalespersonSummary = {
  name: string;
  userId: number | null;
  leads: number;
  openLeads: number;
  deliveredLeads: number;
  deals: number;
  deliveredDeals: number;
  dealValue: number;
  calls: number;
  answeredCalls: number;
  callbacksRequired: number;
    affordabilityAssessments: number;
  matchedAssessments: number;
  whatsappConversations: number;
whatsappWaiting: number;
whatsappUnread: number;
whatsappOutboundMessages: number;
};

type TrendMonth = {
  key: string;
  label: string;
  leads: number;
  deals: number;
  delivered: number;
  deliveredValue: number;
};

const DATE_FILTERS = [
  "All Time",
  "Today",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
];

function formatRand(value: number | null | undefined) {
  if (!value && value !== 0) return "R -";

  return `R ${Number(value).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 min";
  }

  if (value < 60) {
    return `${Math.round(value)} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);

  return minutes > 0
    ? `${hours} hr ${minutes} min`
    : `${hours} hr`;
}

function calculateNetDealValue(deal: Deal) {
  const sale = Number(deal.sale_price) || 0;
  const extras = Number(deal.extras_amount) || 0;
  const discount = Number(deal.discount_amount) || 0;
  const tradeIn = Number(deal.trade_in_value) || 0;
  const settlement = Number(deal.settlement_amount) || 0;

  return sale + extras - discount - tradeIn + settlement;
}

function isDateInFilter(dateValue: string | null, filter: string) {
  if (filter === "All Time") return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const last7 = new Date(now);
  last7.setDate(now.getDate() - 7);

  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  if (filter === "Today") return date >= startOfToday;
  if (filter === "Last 7 Days") return date >= last7;
  if (filter === "Last 30 Days") return date >= last30;
  if (filter === "This Month") return date >= startOfMonth;

  return true;
}

function groupCount(values: Array<string | null | undefined>, fallback: string) {
  const map = new Map<string, number>();

  values.forEach((value) => {
    const key = value || fallback;
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function getMonthKey(dateValue: string | null) {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-ZA", {
    month: "short",
    year: "2-digit",
  });
}

function getLastSixMonthKeys() {
  const now = new Date();
  const keys: string[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return keys;
}

function csvSafe(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value).replace(/"/g, '""');

  return `"${stringValue}"`;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const csvContent = [
    headers.map(csvSafe).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvSafe(row[header])).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function exportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function isFinanceApprovedDeal(deal: Deal) {
  return (
    deal.finance_status === "Approved" ||
    deal.finance_status === "Paid Out" ||
    deal.deal_stage === "Finance Approved" ||
    deal.deal_stage === "Ready for Delivery" ||
    deal.deal_stage === "Delivered"
  );
}

export default function ReportsPage() {
  const { profile } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([]);
  const [financeApplications, setFinanceApplications] = useState<
    FinanceApplication[]
  >([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
const [callLogs, setCallLogs] = useState<CallLog[]>([]);
const [affordabilityAssessments, setAffordabilityAssessments] = useState<
  AffordabilityAssessment[]
>([]);
const [whatsappConversations, setWhatsappConversations] = useState<
  WhatsAppConversationReport[]
>([]);

const [whatsappMessages, setWhatsappMessages] = useState<
  WhatsAppMessageReport[]
>([]);

const [whatsappResponseCycles, setWhatsappResponseCycles] = useState<
  WhatsAppResponseCycle[]
>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("All Time");

function exportFullReportPdf() {
  window.print();
}

  async function fetchReportsData() {
    if (!profile?.company_id) return;

    setLoading(true);

   const [
  leadsResult,
  dealsResult,
  inventoryResult,
  financeResult,
  tasksResult,
  documentsResult,
  callLogsResult,
  affordabilityResult,
  whatsappConversationsResult,
  whatsappMessagesResult,
  whatsappResponseCyclesResult,
] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, customer, status, finance, assigned_user_id, assigned_user_name, created_at"
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("deals")
        .select(
          "id, customer_name, vehicle_name, deal_stage, finance_status, sale_price, deposit_amount, trade_in_value, settlement_amount, extras_amount, discount_amount, assigned_user_id, created_at"
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("inventory_vehicles")
        .select("id, make, model, year, status, price, created_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("finance_applications")
        .select(
          "id, lead_id, customer, vehicle, requested_amount, deposit, finance_status, bank, submitted_at"
        )
        .eq("company_id", profile.company_id)
        .order("id", { ascending: false }),

      supabase
        .from("tasks")
        .select(
          "id, title, status, due_date, assigned_user_id, assigned_user_name, lead_id"
        )
        .eq("company_id", profile.company_id)
        .order("due_date", { ascending: true }),

      supabase
        .from("finance_documents")
        .select(
          "id, lead_id, deal_id, vehicle_id, status, document_type, created_at"
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),

      supabase
  .from("call_logs")
  .select(
    "id, company_id, lead_id, user_profile_id, user_name, phone_number, direction, outcome, notes, called_at, duration_seconds, follow_up_required, follow_up_date, follow_up_task_id, created_at"
  )
  .eq("company_id", profile.company_id)
  .order("called_at", { ascending: false }),  

supabase
  .from("lead_affordability_assessments")
  .select(
    "id, company_id, lead_id, created_by_id, created_by_name, target_monthly_installment, deposit_amount, interest_rate, term_months, balloon_percentage, maximum_vehicle_price, selected_vehicle_id, selected_vehicle_price, estimated_installment, notes, created_at"
  )
  .eq("company_id", profile.company_id)
  .order("created_at", { ascending: false }),

supabase
  .from("whatsapp_conversations")
  .select(
    "id, company_id, lead_id, customer_name, customer_phone, assigned_user_id, assigned_user_name, last_message, last_message_at, last_inbound_at, last_outbound_at, unread_count, waiting_for_response, status, is_unmatched, created_at"
  )
  .eq("company_id", profile.company_id)
  .order("last_message_at", { ascending: false }),

supabase
  .from("whatsapp_messages")
  .select(
    "id, company_id, lead_id, conversation_id, direction, sender_name, message, delivery_status, created_at"
  )
  .eq("company_id", profile.company_id)
  .order("created_at", { ascending: false }),

supabase
  .from("whatsapp_response_cycles")
  .select(
    "inbound_message_id, company_id, lead_id, conversation_id, inbound_message, inbound_at, response_message_id, responder_name, responded_at, response_minutes"
  )
  .eq("company_id", profile.company_id)
  .order("inbound_at", { ascending: false }),

    ]);

    if (leadsResult.error) {
      console.error("Error loading leads report:", leadsResult.error.message);
      setLeads([]);
    } else {
      setLeads(Array.isArray(leadsResult.data) ? leadsResult.data : []);
    }

    if (dealsResult.error) {
      console.error("Error loading deals report:", dealsResult.error.message);
      setDeals([]);
    } else {
      setDeals(Array.isArray(dealsResult.data) ? dealsResult.data : []);
    }

    if (inventoryResult.error) {
      console.error(
        "Error loading inventory report:",
        inventoryResult.error.message
      );
      setVehicles([]);
    } else {
      setVehicles(
        Array.isArray(inventoryResult.data) ? inventoryResult.data : []
      );
    }

    if (financeResult.error) {
      console.error(
        "Error loading finance report:",
        financeResult.error.message
      );
      setFinanceApplications([]);
    } else {
      setFinanceApplications(
        Array.isArray(financeResult.data) ? financeResult.data : []
      );
    }

    if (tasksResult.error) {
      console.error("Error loading tasks report:", tasksResult.error.message);
      setTasks([]);
    } else {
      setTasks(Array.isArray(tasksResult.data) ? tasksResult.data : []);
    }

   if (documentsResult.error) {
  console.error(
    "Error loading documents report:",
    documentsResult.error.message
  );
  setDocuments([]);
} else {
  setDocuments(
    Array.isArray(documentsResult.data) ? documentsResult.data : []
  );
}

if (callLogsResult.error) {
  console.error(
    "Error loading call logs report:",
    callLogsResult.error.message
  );
  setCallLogs([]);
} else {
  setCallLogs(
    Array.isArray(callLogsResult.data) ? callLogsResult.data : []
  );
}

if (affordabilityResult.error) {
  console.error(
    "Error loading affordability report:",
    affordabilityResult.error.message
  );
  setAffordabilityAssessments([]);
} else {
  setAffordabilityAssessments(
    Array.isArray(affordabilityResult.data)
      ? affordabilityResult.data
      : []
  );
}

if (whatsappConversationsResult.error) {
  console.error(
    "Error loading WhatsApp conversations report:",
    whatsappConversationsResult.error.message
  );
  setWhatsappConversations([]);
} else {
  setWhatsappConversations(
    Array.isArray(whatsappConversationsResult.data)
      ? (whatsappConversationsResult.data as WhatsAppConversationReport[])
      : []
  );
}

if (whatsappMessagesResult.error) {
  console.error(
    "Error loading WhatsApp messages report:",
    whatsappMessagesResult.error.message
  );
  setWhatsappMessages([]);
} else {
  setWhatsappMessages(
    Array.isArray(whatsappMessagesResult.data)
      ? (whatsappMessagesResult.data as WhatsAppMessageReport[])
      : []
  );
}

if (whatsappResponseCyclesResult.error) {
  console.error(
    "Error loading WhatsApp response cycles:",
    whatsappResponseCyclesResult.error.message
  );
  setWhatsappResponseCycles([]);
} else {
  setWhatsappResponseCycles(
    Array.isArray(whatsappResponseCyclesResult.data)
      ? (whatsappResponseCyclesResult.data as WhatsAppResponseCycle[])
      : []
  );
}

    setLoading(false);
  }

  useEffect(() => {
    fetchReportsData();
  }, [profile?.company_id]);

  const filteredLeads = useMemo(
    () => leads.filter((item) => isDateInFilter(item.created_at, dateFilter)),
    [leads, dateFilter]
  );




  const filteredDeals = useMemo(
    () => deals.filter((item) => isDateInFilter(item.created_at, dateFilter)),
    [deals, dateFilter]
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((item) => isDateInFilter(item.created_at, dateFilter)),
    [vehicles, dateFilter]
  );

  const filteredFinance = useMemo(
    () =>
      financeApplications.filter((item) =>
        isDateInFilter(item.submitted_at, dateFilter)
      ),
    [financeApplications, dateFilter]
  );

  const filteredDocuments = useMemo(
    () =>
      documents.filter((item) => isDateInFilter(item.created_at, dateFilter)),
    [documents, dateFilter]
  );

const filteredCallLogs = useMemo(
  () =>
    callLogs.filter((item) =>
      isDateInFilter(item.called_at, dateFilter)
    ),
  [callLogs, dateFilter]
);

const filteredAffordabilityAssessments = useMemo(
  () =>
    affordabilityAssessments.filter((item) =>
      isDateInFilter(item.created_at, dateFilter)
    ),
  [affordabilityAssessments, dateFilter]
);
 
const filteredWhatsappConversations = useMemo(
  () =>
    whatsappConversations.filter((item) =>
      isDateInFilter(item.last_message_at, dateFilter)
    ),
  [whatsappConversations, dateFilter]
);

const filteredWhatsappMessages = useMemo(
  () =>
    whatsappMessages.filter((item) =>
      isDateInFilter(item.created_at, dateFilter)
    ),
  [whatsappMessages, dateFilter]
);

const filteredWhatsappResponseCycles = useMemo(
  () =>
    whatsappResponseCycles.filter((item) =>
      isDateInFilter(item.inbound_at, dateFilter)
    ),
  [whatsappResponseCycles, dateFilter]
);

  const now = new Date();

  const totalLeads = filteredLeads.length;

  const openLeads = filteredLeads.filter(
    (lead) =>
      lead.status !== "Lost" &&
      lead.status !== "Delivered" &&
      lead.status !== "Deal Closed"
  ).length;

  const totalDeals = filteredDeals.length;

  const deliveredDeals = filteredDeals.filter(
    (deal) => deal.deal_stage === "Delivered"
  ).length;

  const lostDeals = filteredDeals.filter(
    (deal) => deal.deal_stage === "Lost"
  ).length;

  const financeApprovedDeals = filteredDeals.filter(isFinanceApprovedDeal).length;

  const pipelineDeals = filteredDeals.filter(
    (deal) => deal.deal_stage !== "Delivered" && deal.deal_stage !== "Lost"
  );

  const pipelineValue = pipelineDeals.reduce(
    (sum, deal) => sum + calculateNetDealValue(deal),
    0
  );

  const deliveredValue = filteredDeals
    .filter((deal) => deal.deal_stage === "Delivered")
    .reduce((sum, deal) => sum + calculateNetDealValue(deal), 0);

  const financeApproved = filteredFinance.filter(
    (finance) => finance.finance_status === "Approved"
  ).length;

  const financeSubmitted = filteredFinance.filter(
    (finance) =>
      finance.finance_status === "Submitted" || !finance.finance_status
  ).length;

  const availableVehicles = filteredVehicles.filter(
    (vehicle) => vehicle.status === "Available"
  ).length;

  const reservedVehicles = filteredVehicles.filter(
    (vehicle) => vehicle.status === "Reserved"
  ).length;

  const stockValue = filteredVehicles.reduce(
    (sum, vehicle) => sum + (Number(vehicle.price) || 0),
    0
  );

  const overdueTasks = tasks.filter((task) => {
    if (!task.due_date || task.status === "Completed") return false;
    return new Date(task.due_date) < now;
  }).length;

  const openTasks = tasks.filter((task) => task.status !== "Completed").length;
const totalCalls = filteredCallLogs.length;

const answeredCalls = filteredCallLogs.filter(
  (call) => call.outcome === "Answered"
).length;

const answeredRate = percentage(answeredCalls, totalCalls);

const callbacksRequired = filteredCallLogs.filter(
  (call) => call.follow_up_required
).length;

const pendingCallbacks = filteredCallLogs.filter((call) => {
  if (!call.follow_up_required || !call.follow_up_date) return false;

  return new Date(call.follow_up_date) >= new Date();
}).length;

const overdueCallbacks = filteredCallLogs.filter((call) => {
  if (!call.follow_up_required || !call.follow_up_date) return false;

  return new Date(call.follow_up_date) < new Date();
}).length;

  const leadStatusBuckets = groupCount(
    filteredLeads.map((lead) => lead.status),
    "New Lead"
  );

  const dealStageBuckets = groupCount(
    filteredDeals.map((deal) => deal.deal_stage),
    "Draft"
  );

  const financeStatusBuckets = groupCount(
    filteredFinance.map((finance) => finance.finance_status),
    "Submitted"
  );

  const inventoryStatusBuckets = groupCount(
    filteredVehicles.map((vehicle) => vehicle.status),
    "Available"
  );

  const documentStatusBuckets = groupCount(
    filteredDocuments.map((doc) => doc.status),
    "Pending"
  );

const callOutcomeBuckets = groupCount(
  filteredCallLogs.map((call) => call.outcome),
  "Unknown"
);

const totalAffordabilityAssessments =
  filteredAffordabilityAssessments.length;

const assessmentsWithMatchedVehicles =
  filteredAffordabilityAssessments.filter(
    (assessment) => assessment.selected_vehicle_id !== null
  ).length;

const affordabilityMatchRate = percentage(
  assessmentsWithMatchedVehicles,
  totalAffordabilityAssessments
);

const averageTargetInstallment =
  totalAffordabilityAssessments > 0
    ? filteredAffordabilityAssessments.reduce(
        (sum, assessment) =>
          sum + Number(assessment.target_monthly_installment || 0),
        0
      ) / totalAffordabilityAssessments
    : 0;

const averageMaximumVehiclePrice =
  totalAffordabilityAssessments > 0
    ? filteredAffordabilityAssessments.reduce(
        (sum, assessment) =>
          sum + Number(assessment.maximum_vehicle_price || 0),
        0
      ) / totalAffordabilityAssessments
    : 0;

const averageDeposit =
  totalAffordabilityAssessments > 0
    ? filteredAffordabilityAssessments.reduce(
        (sum, assessment) =>
          sum + Number(assessment.deposit_amount || 0),
        0
      ) / totalAffordabilityAssessments
    : 0;

const averageBalloonPercentage =
  totalAffordabilityAssessments > 0
    ? filteredAffordabilityAssessments.reduce(
        (sum, assessment) =>
          sum + Number(assessment.balloon_percentage || 0),
        0
      ) / totalAffordabilityAssessments
    : 0;

const totalWhatsappConversations =
  filteredWhatsappConversations.length;

const openWhatsappConversations =
  filteredWhatsappConversations.filter(
    (item) => item.status === "Open"
  ).length;

const unreadWhatsappConversations =
  filteredWhatsappConversations.filter(
    (item) => Number(item.unread_count) > 0
  ).length;

const waitingWhatsappConversations =
  filteredWhatsappConversations.filter(
    (item) => item.waiting_for_response
  ).length;

const unmatchedWhatsappConversations =
  filteredWhatsappConversations.filter(
    (item) => item.is_unmatched
  ).length;

const inboundWhatsappMessages =
  filteredWhatsappMessages.filter(
    (item) => item.direction === "Inbound"
  ).length;

const outboundWhatsappMessages =
  filteredWhatsappMessages.filter(
    (item) => item.direction === "Outbound"
  ).length;

const deliveredWhatsappMessages =
  filteredWhatsappMessages.filter(
    (item) =>
      item.direction === "Outbound" &&
      ["Delivered", "Read"].includes(
        item.delivery_status || ""
      )
  ).length;

const readWhatsappMessages =
  filteredWhatsappMessages.filter(
    (item) =>
      item.direction === "Outbound" &&
      item.delivery_status === "Read"
  ).length;

const failedWhatsappMessages =
  filteredWhatsappMessages.filter(
    (item) =>
      item.direction === "Outbound" &&
      item.delivery_status === "Failed"
  ).length;

const whatsappDeliveryRate = percentage(
  deliveredWhatsappMessages,
  outboundWhatsappMessages
);

const whatsappReadRate = percentage(
  readWhatsappMessages,
  outboundWhatsappMessages
);

const respondedWhatsappCycles =
  filteredWhatsappResponseCycles.filter(
    (item) =>
      item.responded_at !== null &&
      item.response_minutes !== null &&
      Number(item.response_minutes) >= 0
  );

const unansweredWhatsappCycles =
  filteredWhatsappResponseCycles.filter(
    (item) => item.responded_at === null
  );

const averageWhatsappResponseMinutes =
  respondedWhatsappCycles.length > 0
    ? respondedWhatsappCycles.reduce(
        (sum, item) =>
          sum + Number(item.response_minutes || 0),
        0
      ) / respondedWhatsappCycles.length
    : 0;

const sortedWhatsappResponseMinutes =
  respondedWhatsappCycles
    .map((item) => Number(item.response_minutes || 0))
    .sort((a, b) => a - b);

const medianWhatsappResponseMinutes =
  sortedWhatsappResponseMinutes.length === 0
    ? 0
    : sortedWhatsappResponseMinutes.length % 2 === 1
    ? sortedWhatsappResponseMinutes[
        Math.floor(sortedWhatsappResponseMinutes.length / 2)
      ]
    : (
        sortedWhatsappResponseMinutes[
          sortedWhatsappResponseMinutes.length / 2 - 1
        ] +
        sortedWhatsappResponseMinutes[
          sortedWhatsappResponseMinutes.length / 2
        ]
      ) / 2;

  const conversionLeadToDeal = percentage(totalDeals, totalLeads);
  const conversionDealToFinance = percentage(financeApprovedDeals, totalDeals);
  const conversionFinanceToDelivered = percentage(
    deliveredDeals,
    financeApprovedDeals
  );
  const conversionLeadToDelivered = percentage(deliveredDeals, totalLeads);

  const monthlyTrend = useMemo(() => {
    const keys = getLastSixMonthKeys();

    const baseMap = new Map<string, TrendMonth>();

    keys.forEach((key) => {
      baseMap.set(key, {
        key,
        label: getMonthLabel(key),
        leads: 0,
        deals: 0,
        delivered: 0,
        deliveredValue: 0,
      });
    });

    leads.forEach((lead) => {
      const key = getMonthKey(lead.created_at);
      if (!key || !baseMap.has(key)) return;

      baseMap.get(key)!.leads += 1;
    });

    deals.forEach((deal) => {
      const key = getMonthKey(deal.created_at);
      if (!key || !baseMap.has(key)) return;

      const month = baseMap.get(key)!;

      month.deals += 1;

      if (deal.deal_stage === "Delivered") {
        month.delivered += 1;
        month.deliveredValue += calculateNetDealValue(deal);
      }
    });

    return keys.map((key) => baseMap.get(key)!);
  }, [leads, deals]);

  const maxTrendValue = Math.max(
    ...monthlyTrend.map((month) =>
      Math.max(month.leads, month.deals, month.delivered)
    ),
    1
  );

  const salespersonSummaries = useMemo(() => {
    const map = new Map<string, SalespersonSummary>();

    filteredLeads.forEach((lead) => {
      const key = String(
        lead.assigned_user_id || lead.assigned_user_name || "Unassigned"
      );



      if (!map.has(key)) {
        map.set(key, {
          name: lead.assigned_user_name || "Unassigned",
          userId: lead.assigned_user_id,
          leads: 0,
          openLeads: 0,
          deliveredLeads: 0,
          deals: 0,
          deliveredDeals: 0,
          dealValue: 0,
          calls: 0,
          answeredCalls: 0,
          callbacksRequired: 0,
          affordabilityAssessments: 0,
          matchedAssessments: 0,
          whatsappConversations: 0,
          whatsappWaiting: 0,
          whatsappUnread: 0,
          whatsappOutboundMessages: 0,
        });
      }

      const summary = map.get(key)!;
      summary.leads += 1;

      if (
        lead.status !== "Lost" &&
        lead.status !== "Delivered" &&
        lead.status !== "Deal Closed"
      ) {
        summary.openLeads += 1;
      }

      if (lead.status === "Delivered" || lead.status === "Deal Closed") {
        summary.deliveredLeads += 1;
      }
    });

    filteredDeals.forEach((deal) => {
      const key = String(deal.assigned_user_id || "Unassigned");

      if (!map.has(key)) {
        map.set(key, {
          name:
            filteredLeads.find(
              (lead) => lead.assigned_user_id === deal.assigned_user_id
            )?.assigned_user_name || "Unassigned",
          userId: deal.assigned_user_id,
          leads: 0,
          openLeads: 0,
          deliveredLeads: 0,
          deals: 0,
          deliveredDeals: 0,
          dealValue: 0,
          calls: 0,
          answeredCalls: 0,
          callbacksRequired: 0,
          affordabilityAssessments: 0,
          matchedAssessments: 0,
          whatsappConversations: 0,
          whatsappWaiting: 0,
          whatsappUnread: 0,
          whatsappOutboundMessages: 0,
        });
      }

      const summary = map.get(key)!;
      summary.deals += 1;
      summary.dealValue += calculateNetDealValue(deal);

      if (deal.deal_stage === "Delivered") {
        summary.deliveredDeals += 1;
      }



    });

filteredCallLogs.forEach((call) => {
  const key = String(
    call.user_profile_id || call.user_name || "Unassigned"
  );

  if (!map.has(key)) {
    map.set(key, {
      name: call.user_name || "Unassigned",
      userId: call.user_profile_id,
      leads: 0,
      openLeads: 0,
      deliveredLeads: 0,
      deals: 0,
      deliveredDeals: 0,
      dealValue: 0,
      calls: 0,
      answeredCalls: 0,
      callbacksRequired: 0,
      affordabilityAssessments: 0,
      matchedAssessments: 0,
      whatsappConversations: 0,
      whatsappWaiting: 0,
      whatsappUnread: 0,
      whatsappOutboundMessages: 0,
    });
  }

  const summary = map.get(key)!;

  summary.calls += 1;

  if (call.outcome === "Answered") {
    summary.answeredCalls += 1;
  }

  if (call.follow_up_required) {
    summary.callbacksRequired += 1;
  }
});


filteredAffordabilityAssessments.forEach((assessment) => {
  const key = String(
    assessment.created_by_id ||
      assessment.created_by_name ||
      "Unassigned"
  );

  if (!map.has(key)) {
    map.set(key, {
      name: assessment.created_by_name || "Unassigned",
      userId: assessment.created_by_id,
      leads: 0,
      openLeads: 0,
      deliveredLeads: 0,
      deals: 0,
      deliveredDeals: 0,
      dealValue: 0,
      calls: 0,
      answeredCalls: 0,
      callbacksRequired: 0,
      affordabilityAssessments: 0,
      matchedAssessments: 0,
      whatsappConversations: 0,
whatsappWaiting: 0,
whatsappUnread: 0,
whatsappOutboundMessages: 0,
    });
  }

  const summary = map.get(key)!;

  summary.affordabilityAssessments += 1;

  if (assessment.selected_vehicle_id !== null) {
    summary.matchedAssessments += 1;
  }
});

filteredWhatsappConversations.forEach((conversation) => {
  const key = String(
    conversation.assigned_user_id ||
      conversation.assigned_user_name ||
      "Unassigned"
  );

  if (!map.has(key)) {
    map.set(key, {
      name: conversation.assigned_user_name || "Unassigned",
      userId: conversation.assigned_user_id,
      leads: 0,
      openLeads: 0,
      deliveredLeads: 0,
      deals: 0,
      deliveredDeals: 0,
      dealValue: 0,
      calls: 0,
      answeredCalls: 0,
      callbacksRequired: 0,
      affordabilityAssessments: 0,
      matchedAssessments: 0,
      whatsappConversations: 0,
      whatsappWaiting: 0,
      whatsappUnread: 0,
      whatsappOutboundMessages: 0,
    });
  }

  const summary = map.get(key)!;

  summary.whatsappConversations += 1;

  if (conversation.waiting_for_response) {
    summary.whatsappWaiting += 1;
  }

  if (Number(conversation.unread_count) > 0) {
    summary.whatsappUnread += 1;
  }
});

filteredWhatsappMessages
  .filter((message) => message.direction === "Outbound")
  .forEach((message) => {
    const matchingConversation =
      filteredWhatsappConversations.find(
        (conversation) =>
          conversation.id === message.conversation_id
      );

    const key = String(
      matchingConversation?.assigned_user_id ||
        matchingConversation?.assigned_user_name ||
        "Unassigned"
    );

    if (!map.has(key)) {
      map.set(key, {
        name:
          matchingConversation?.assigned_user_name ||
          "Unassigned",
        userId:
          matchingConversation?.assigned_user_id || null,
        leads: 0,
        openLeads: 0,
        deliveredLeads: 0,
        deals: 0,
        deliveredDeals: 0,
        dealValue: 0,
        calls: 0,
        answeredCalls: 0,
        callbacksRequired: 0,
        affordabilityAssessments: 0,
        matchedAssessments: 0,
        whatsappConversations: 0,
        whatsappWaiting: 0,
        whatsappUnread: 0,
        whatsappOutboundMessages: 0,
      });
    }

    map.get(key)!.whatsappOutboundMessages += 1;
  });

    return Array.from(map.values()).sort((a, b) => b.dealValue - a.dealValue);
  }, [
  filteredLeads,
  filteredDeals,
  filteredCallLogs,
  filteredAffordabilityAssessments,
  filteredWhatsappConversations,
  filteredWhatsappMessages,
]);

function exportLeadsCsv() {
  downloadCsv(
    `dealflow-leads-report-${exportDateStamp()}.csv`,
    filteredLeads.map((lead) => ({
      "Lead ID": lead.id,
      Customer: lead.customer || "",
      Status: lead.status || "New Lead",
      Finance: lead.finance || "",
      "Assigned User": lead.assigned_user_name || "Unassigned",
      "Created Date": lead.created_at ? formatDate(lead.created_at) : "",
    }))
  );
}

function exportDealsCsv() {
  downloadCsv(
    `dealflow-deals-report-${exportDateStamp()}.csv`,
    filteredDeals.map((deal) => ({
      "Deal ID": deal.id,
      Customer: deal.customer_name || "",
      Vehicle: deal.vehicle_name || "",
      Stage: deal.deal_stage || "Draft",
      "Finance Status": deal.finance_status || "Not Started",
      "Sale Price": Number(deal.sale_price) || 0,
      "Deposit": Number(deal.deposit_amount) || 0,
      "Trade-In Value": Number(deal.trade_in_value) || 0,
      "Settlement Amount": Number(deal.settlement_amount) || 0,
      Extras: Number(deal.extras_amount) || 0,
      Discount: Number(deal.discount_amount) || 0,
      "Net Deal Value": calculateNetDealValue(deal),
      "Created Date": deal.created_at ? formatDate(deal.created_at) : "",
    }))
  );
}

function exportFinanceCsv() {
  downloadCsv(
    `dealflow-finance-report-${exportDateStamp()}.csv`,
    filteredFinance.map((finance) => ({
      "Finance ID": finance.id,
      "Lead ID": finance.lead_id || "",
      Customer: finance.customer || "",
      Vehicle: finance.vehicle || "",
      Bank: finance.bank || "",
      Status: finance.finance_status || "Submitted",
      "Requested Amount": Number(finance.requested_amount) || 0,
      Deposit: Number(finance.deposit) || 0,
      "Submitted Date": finance.submitted_at
        ? formatDate(finance.submitted_at)
        : "",
    }))
  );
}

function exportCallsCsv() {
  downloadCsv(
    `dealflow-call-report-${exportDateStamp()}.csv`,
    filteredCallLogs.map((call) => ({
      "Call ID": call.id,
      "Lead ID": call.lead_id,
      "Logged By": call.user_name || "Unknown User",
      "Phone Number": call.phone_number || "",
      Direction: call.direction,
      Outcome: call.outcome,
      Notes: call.notes || "",
      "Call Date": call.called_at
        ? new Date(call.called_at).toLocaleString("en-ZA")
        : "",
      "Follow-Up Required": call.follow_up_required ? "Yes" : "No",
      "Follow-Up Date": call.follow_up_date
        ? new Date(call.follow_up_date).toLocaleString("en-ZA")
        : "",
      "Follow-Up Task ID": call.follow_up_task_id || "",
    }))
  );
}

function exportWhatsappCsv() {
  downloadCsv(
    `dealflow-whatsapp-report-${exportDateStamp()}.csv`,
    filteredWhatsappConversations.map((conversation) => ({
      "Conversation ID": conversation.id,
      "Lead ID": conversation.lead_id || "",
      Customer: conversation.customer_name || "",
      "Phone Number": conversation.customer_phone || "",
      "Assigned User":
        conversation.assigned_user_name || "Unassigned",
      Status: conversation.status,
      "Unread Count": conversation.unread_count,
      "Waiting for Response":
        conversation.waiting_for_response ? "Yes" : "No",
      "Unmatched Contact":
        conversation.is_unmatched ? "Yes" : "No",
      "Last Message": conversation.last_message || "",
      "Last Message Date": conversation.last_message_at
        ? new Date(
            conversation.last_message_at
          ).toLocaleString("en-ZA")
        : "",
      "Last Inbound Date": conversation.last_inbound_at
        ? new Date(
            conversation.last_inbound_at
          ).toLocaleString("en-ZA")
        : "",
      "Last Outbound Date": conversation.last_outbound_at
        ? new Date(
            conversation.last_outbound_at
          ).toLocaleString("en-ZA")
        : "",
    }))
  );
}

function exportSalespersonCsv() {
  downloadCsv(
    `dealflow-salesperson-performance-${exportDateStamp()}.csv`,
    salespersonSummaries.map((person) => ({
      Salesperson: person.name,
      Leads: person.leads,
      "Open Leads": person.openLeads,
      "Delivered Leads": person.deliveredLeads,
      Deals: person.deals,
      "Delivered Deals": person.deliveredDeals,
      "Deal Value": person.dealValue,
Calls: person.calls,
"Answered Calls": person.answeredCalls,
"Answered Rate %": percentage(person.answeredCalls, person.calls),
"Callbacks Required": person.callbacksRequired,
"Affordability Assessments": person.affordabilityAssessments,
"Assessments With Vehicle": person.matchedAssessments,
"Affordability Match Rate %": percentage(
  person.matchedAssessments,
  person.affordabilityAssessments
),
"WhatsApp Conversations":
  person.whatsappConversations,

"WhatsApp Outbound Messages":
  person.whatsappOutboundMessages,

"WhatsApp Waiting":
  person.whatsappWaiting,

"WhatsApp Unread":
  person.whatsappUnread,
"Lead to Deal %": percentage(person.deals, person.leads),
      "Deal to Delivered %": percentage(person.deliveredDeals, person.deals),
    }))
  );
}


function exportAffordabilityCsv() {
  downloadCsv(
    `dealflow-affordability-report-${exportDateStamp()}.csv`,
    filteredAffordabilityAssessments.map((assessment) => ({
      "Assessment ID": assessment.id,
      "Lead ID": assessment.lead_id,
      "Created By": assessment.created_by_name || "Unknown User",
      "Target Monthly Instalment": Number(
        assessment.target_monthly_installment
      ),
      Deposit: Number(assessment.deposit_amount),
      "Interest Rate %": Number(assessment.interest_rate),
      "Term Months": assessment.term_months,
      "Balloon %": Number(assessment.balloon_percentage),
      "Maximum Vehicle Price": Number(
        assessment.maximum_vehicle_price
      ),
      "Vehicle Selected":
        assessment.selected_vehicle_id !== null ? "Yes" : "No",
      "Selected Vehicle ID": assessment.selected_vehicle_id || "",
      "Selected Vehicle Price":
        assessment.selected_vehicle_price !== null
          ? Number(assessment.selected_vehicle_price)
          : "",
      "Estimated Instalment":
        assessment.estimated_installment !== null
          ? Number(assessment.estimated_installment)
          : "",
      Notes: assessment.notes || "",
      "Assessment Date": assessment.created_at
        ? new Date(assessment.created_at).toLocaleString("en-ZA")
        : "",
    }))
  );
}

  const recentDeliveredDeals = filteredDeals
    .filter((deal) => deal.deal_stage === "Delivered")
    .slice(0, 5);

  

 return (
  <DashboardLayout>
    <PageAccessGuard module="reports">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
                Business insight
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Reports</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Dealership performance, pipeline, finance and operational reporting.
              </p>
            </div>

          <div className="flex flex-col gap-3 sm:flex-row no-print">
  <select
    value={dateFilter}
    onChange={(e) => setDateFilter(e.target.value)}
    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold text-slate-700"
  >
    {DATE_FILTERS.map((filter) => (
      <option key={filter}>{filter}</option>
    ))}
  </select>

  <button
    onClick={fetchReportsData}
    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
  >
    Refresh
  </button>

  <button
    onClick={exportFullReportPdf}
    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
  >
    Export PDF
  </button>
</div>
          </div>
        </div>

<div className="no-print rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Export Reports
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Download filtered report data based on the selected period: {dateFilter}.
      </p>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
      <button
        onClick={exportLeadsCsv}
        className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
      >
        Export Leads
      </button>

      <button
        onClick={exportDealsCsv}
        className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
      >
        Export Deals
      </button>

      <button
        onClick={exportFinanceCsv}
        className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
      >
        Export Finance
      </button>

<button
  onClick={exportCallsCsv}
  className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
>
  Export Calls
</button>

<button
  onClick={exportAffordabilityCsv}
  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
>
  Export Affordability
</button>

      <button
        onClick={exportSalespersonCsv}
        className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
      >
        Export Salespeople
      </button>
      <button
  onClick={exportWhatsappCsv}
  className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
>
  Export WhatsApp
</button>
    </div>
  </div>
</div>

       {loading ? (
  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
    Loading reports...
  </div>
) : (
  <div id="report-print-area" className="space-y-6">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <MetricCard label="Total Leads" value={totalLeads} />
              <MetricCard label="Open Leads" value={openLeads} color="blue" />
              <MetricCard label="Deals Created" value={totalDeals} />
              <MetricCard
                label="Delivered Deals"
                value={deliveredDeals}
                color="green"
              />
              <MetricCard
                label="Pipeline Value"
                value={formatRand(pipelineValue)}
                color="orange"
              />
              <MetricCard
                label="Delivered Value"
                value={formatRand(deliveredValue)}
                color="green"
              />
              <MetricCard
                label="Finance Approved"
                value={financeApproved}
                color="green"
              />
              <MetricCard
                label="Overdue Tasks"
                value={overdueTasks}
                color="red"
              />
<MetricCard
  label="Total Calls"
  value={totalCalls}
  color="blue"
/>

<MetricCard
  label="Answered Calls"
  value={answeredCalls}
  color="green"
/>

<MetricCard
  label="Answered Rate"
  value={`${answeredRate}%`}
  color="green"
/>

<MetricCard
  label="Callbacks Required"
  value={callbacksRequired}
  color="orange"
/>

<MetricCard
  label="Affordability Assessments"
  value={totalAffordabilityAssessments}
  color="orange"
/>

<MetricCard
  label="Vehicle Match Rate"
  value={`${affordabilityMatchRate}%`}
  color="green"
/>

<MetricCard
  label="Average Target Instalment"
  value={formatRand(averageTargetInstallment)}
  color="blue"
/>

<MetricCard
  label="Average Maximum Price"
  value={formatRand(averageMaximumVehiclePrice)}
  color="orange"
/>

<MetricCard
  label="WhatsApp Conversations"
  value={totalWhatsappConversations}
  color="green"
/>

<MetricCard
  label="Customers Waiting"
  value={waitingWhatsappConversations}
  color="orange"
/>

<MetricCard
  label="Unread WhatsApp"
  value={unreadWhatsappConversations}
  color="red"
/>

<MetricCard
  label="Median Response Time"
  value={formatMinutes(medianWhatsappResponseMinutes)}
  color="blue"
/>

            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <div className="print-section rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Lead to Delivery Conversion Funnel
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Shows how leads move through deals, finance approval and
                      delivery.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {dateFilter}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <FunnelStep
                    label="Total Leads"
                    value={totalLeads}
                    total={totalLeads}
                    description="Starting lead pool"
                    color="blue"
                  />

                  <FunnelStep
                    label="Deals Created"
                    value={totalDeals}
                    total={totalLeads}
                    description={`${conversionLeadToDeal}% of leads converted into deals`}
                    color="green"
                  />

                  <FunnelStep
                    label="Finance Approved Deals"
                    value={financeApprovedDeals}
                    total={totalDeals}
                    description={`${conversionDealToFinance}% of deals reached finance approval`}
                    color="orange"
                  />

                  <FunnelStep
                    label="Delivered Deals"
                    value={deliveredDeals}
                    total={financeApprovedDeals}
                    description={`${conversionFinanceToDelivered}% of finance-approved deals delivered`}
                    color="purple"
                  />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <ConversionCard
                    label="Lead → Deal"
                    value={`${conversionLeadToDeal}%`}
                  />
                  <ConversionCard
                    label="Deal → Finance Approved"
                    value={`${conversionDealToFinance}%`}
                  />
                  <ConversionCard
                    label="Finance Approved → Delivered"
                    value={`${conversionFinanceToDelivered}%`}
                  />
                  <ConversionCard
                    label="Lead → Delivered"
                    value={`${conversionLeadToDelivered}%`}
                  />
                </div>
              </div>

              <div className="print-section rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      6-Month Activity Trend
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Monthly leads, deals and delivered deals.
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    Live data
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  {monthlyTrend.map((month) => (
                    <div key={month.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">
                          {month.label}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          Delivered value: {formatRand(month.deliveredValue)}
                        </p>
                      </div>

                      <TrendBar
                        label="Leads"
                        value={month.leads}
                        max={maxTrendValue}
                        color="blue"
                      />

                      <TrendBar
                        label="Deals"
                        value={month.deals}
                        max={maxTrendValue}
                        color="green"
                      />

                      <TrendBar
                        label="Delivered"
                        value={month.delivered}
                        max={maxTrendValue}
                        color="purple"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-4">
              <ReportCard title="Leads by Status">
                <BucketList buckets={leadStatusBuckets} total={totalLeads} />
              </ReportCard>

              <ReportCard title="Deals by Stage">
                <BucketList buckets={dealStageBuckets} total={totalDeals} />
              </ReportCard>

              <ReportCard title="Finance by Status">
                <BucketList
                  buckets={financeStatusBuckets}
                  total={filteredFinance.length}
                />
              </ReportCard>

              <ReportCard title="Inventory by Status">
                <BucketList
                  buckets={inventoryStatusBuckets}
                  total={filteredVehicles.length}
                />
              </ReportCard>
            </div>
<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
  <ReportCard title="Call Outcomes">
    <BucketList
      buckets={callOutcomeBuckets}
      total={filteredCallLogs.length}
    />
  </ReportCard>

  <ReportCard title="Call Performance Snapshot">
    <div className="space-y-3">
      <SnapshotRow label="Total Calls" value={totalCalls} />
      <SnapshotRow label="Answered Calls" value={answeredCalls} />
      <SnapshotRow label="Answered Rate" value={`${answeredRate}%`} />
      <SnapshotRow
        label="Callbacks Required"
        value={callbacksRequired}
      />
      <SnapshotRow
        label="Upcoming Callbacks"
        value={pendingCallbacks}
      />
      <SnapshotRow
        label="Past-Due Callbacks"
        value={overdueCallbacks}
      />
    </div>
  </ReportCard>

<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
  <ReportCard title="Affordability Performance">
    <div className="space-y-3">
      <SnapshotRow
        label="Assessments Completed"
        value={totalAffordabilityAssessments}
      />

      <SnapshotRow
        label="Assessments With Vehicle"
        value={assessmentsWithMatchedVehicles}
      />

      <SnapshotRow
        label="Vehicle Match Rate"
        value={`${affordabilityMatchRate}%`}
      />

      <SnapshotRow
        label="Average Target Instalment"
        value={formatRand(averageTargetInstallment)}
      />

      <SnapshotRow
        label="Average Maximum Price"
        value={formatRand(averageMaximumVehiclePrice)}
      />

      <SnapshotRow
        label="Average Deposit"
        value={formatRand(averageDeposit)}
      />

      <SnapshotRow
        label="Average Balloon"
        value={`${averageBalloonPercentage.toFixed(1)}%`}
      />
    </div>
  </ReportCard>

  <ReportCard title="Recent Affordability Assessments">
    <div className="space-y-3">
      {filteredAffordabilityAssessments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No affordability assessments found.
          </p>
        </div>
      ) : (
        filteredAffordabilityAssessments
          .slice(0, 5)
          .map((assessment) => (
            <div
              key={assessment.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Lead #{assessment.lead_id}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Maximum price:{" "}
                    {formatRand(assessment.maximum_vehicle_price)}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Target:{" "}
                    {formatRand(
                      assessment.target_monthly_installment
                    )}
                    /month
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    assessment.selected_vehicle_id !== null
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {assessment.selected_vehicle_id !== null
                    ? "Vehicle Matched"
                    : "No Vehicle"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500">
                  {assessment.created_by_name || "Unknown User"}
                </p>

                <p className="text-xs text-slate-400">
                  {formatDate(assessment.created_at)}
                </p>
              </div>

              <Link
                href={`/leads/${assessment.lead_id}`}
                className="mt-3 inline-flex rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400"
              >
                Open Lead
              </Link>
            </div>
          ))
      )}
    </div>
  </ReportCard>
</div>
<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
  <ReportCard title="WhatsApp Performance">
    <div className="space-y-3">
      <SnapshotRow
        label="Total Conversations"
        value={totalWhatsappConversations}
      />

      <SnapshotRow
        label="Open Conversations"
        value={openWhatsappConversations}
      />

      <SnapshotRow
        label="Inbound Messages"
        value={inboundWhatsappMessages}
      />

      <SnapshotRow
        label="Outbound Messages"
        value={outboundWhatsappMessages}
      />

      <SnapshotRow
        label="Delivery Rate"
        value={`${whatsappDeliveryRate}%`}
      />

      <SnapshotRow
        label="Read Rate"
        value={`${whatsappReadRate}%`}
      />

      <SnapshotRow
        label="Failed Messages"
        value={failedWhatsappMessages}
      />

      <SnapshotRow
        label="Average Response Time"
        value={formatMinutes(
          averageWhatsappResponseMinutes
        )}
      />

      <SnapshotRow
        label="Median Response Time"
        value={formatMinutes(
          medianWhatsappResponseMinutes
        )}
      />

      <SnapshotRow
        label="Unanswered Response Cycles"
        value={unansweredWhatsappCycles.length}
      />

      <SnapshotRow
        label="Unmatched Contacts"
        value={unmatchedWhatsappConversations}
      />
    </div>
  </ReportCard>

  <ReportCard title="Customers Awaiting WhatsApp Response">
    <div className="space-y-3">
      {filteredWhatsappConversations.filter(
        (conversation) =>
          conversation.waiting_for_response &&
          conversation.status === "Open"
      ).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No customers are currently waiting.
          </p>
        </div>
      ) : (
        filteredWhatsappConversations
          .filter(
            (conversation) =>
              conversation.waiting_for_response &&
              conversation.status === "Open"
          )
          .slice(0, 8)
          .map((conversation) => (
            <div
              key={conversation.id}
              className="rounded-xl border border-orange-200 bg-orange-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {conversation.customer_name ||
                      "WhatsApp Customer"}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {conversation.last_message ||
                      "No message preview"}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Assigned to{" "}
                    {conversation.assigned_user_name ||
                      "Unassigned"}
                  </p>
                </div>

                {conversation.unread_count > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    {conversation.unread_count} unread
                  </span>
                )}
              </div>

              <Link
                href={`/whatsapp?conversation=${conversation.id}`}
                className="mt-3 inline-flex rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
              >
                Open Conversation
              </Link>
            </div>
          ))
      )}
    </div>
  </ReportCard>
</div>
</div>
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="print-section print-page rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Salesperson Performance
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Lead ownership, deal count and delivered deal value.
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[1850px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Salesperson
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Leads
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Open Leads
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Deals
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Delivered
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Calls
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Answered
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Answer Rate
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Assessments
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Vehicle Matches
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  Match Rate
</th>
<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  WA Conversations
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  WA Messages
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  WA Waiting
</th>

<th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
  WA Unread
</th>

                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                          Deal Value
                        </th>

                      </tr>
                    </thead>

                    <tbody>
                      {salespersonSummaries.map((person) => (
                        <tr
                          key={`${person.userId}-${person.name}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">
                              {person.name}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {person.leads}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {person.openLeads}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {person.deals}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {person.deliveredDeals}
                          </td>
                         
<td className="px-4 py-4 text-slate-700">
  {person.calls}
</td>

<td className="px-4 py-4 text-slate-700">
  {person.answeredCalls}
</td>

<td className="px-4 py-4 text-slate-700">
  {percentage(person.answeredCalls, person.calls)}%
</td>

<td className="px-4 py-4 text-slate-700">
  {person.affordabilityAssessments}
</td>

<td className="px-4 py-4 text-slate-700">
  {person.matchedAssessments}
</td>

<td className="px-4 py-4 text-slate-700">
  {percentage(
    person.matchedAssessments,
    person.affordabilityAssessments
  )}
  %
</td>
<td className="px-4 py-4 text-slate-700">
  {person.whatsappConversations}
</td>

<td className="px-4 py-4 text-slate-700">
  {person.whatsappOutboundMessages}
</td>

<td className="px-4 py-4 text-slate-700">
  {person.whatsappWaiting}
</td>

<td className="px-4 py-4 text-slate-700">
  {person.whatsappUnread}
</td>
                          <td className="px-4 py-4 font-bold text-slate-900">
                            {formatRand(person.dealValue)}
                          </td>
                        </tr>
                      ))}

                      {salespersonSummaries.length === 0 && (
                        <tr>
                          <td
                            colSpan={16}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No salesperson data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-5">
                <ReportCard title="Operational Snapshot">
                  <div className="space-y-3">
                    <SnapshotRow label="Open Tasks" value={openTasks} />
                    <SnapshotRow label="Overdue Tasks" value={overdueTasks} />
                    <SnapshotRow
                      label="Available Vehicles"
                      value={availableVehicles}
                    />
                   
                    <SnapshotRow
                      label="Reserved Vehicles"
                      value={reservedVehicles}
                    />
                    <SnapshotRow
                      label="Stock Value"
                      value={formatRand(stockValue)}
                    />
                    <SnapshotRow
                      label="Finance Submitted"
                      value={financeSubmitted}
                    />
                    <SnapshotRow label="Lost Deals" value={lostDeals} />
                    <SnapshotRow label="Total Calls" value={totalCalls} />
<SnapshotRow label="Answered Rate" value={`${answeredRate}%`} />
<SnapshotRow
  label="Callbacks Required"
  value={callbacksRequired}
/>
<SnapshotRow
  label="WhatsApp Customers Waiting"
  value={waitingWhatsappConversations}
/>

<SnapshotRow
  label="Unread WhatsApp"
  value={unreadWhatsappConversations}
/>

<SnapshotRow
  label="Median WhatsApp Response"
  value={formatMinutes(
    medianWhatsappResponseMinutes
  )}
/>
                  </div>
                </ReportCard>

                <ReportCard title="Documents by Status">
                  <BucketList
                    buckets={documentStatusBuckets}
                    total={filteredDocuments.length}
                  />
                </ReportCard>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="print-section rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Recent Delivered Deals
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Latest completed deals in the selected period.
                </p>

                <div className="mt-5 space-y-3">
                  {recentDeliveredDeals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-700">
                        No delivered deals found.
                      </p>
                    </div>
                  ) : (
                    recentDeliveredDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              Deal #{deal.id}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {deal.customer_name || "Unknown customer"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {deal.vehicle_name || "No vehicle"} •{" "}
                              {formatDate(deal.created_at)}
                            </p>
                          </div>

                          <p className="text-sm font-extrabold text-green-700">
                            {formatRand(calculateNetDealValue(deal))}
                          </p>
                        </div>

                        <Link
                          href={`/deals/${deal.id}`}
                          className="mt-4 inline-flex rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                        >
                          Open Deal
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="print-section rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Report Notes
                </h2>

                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  <p>
  The date filter applies to leads, deals, inventory, finance
  applications, documents, calls, affordability assessments,
  WhatsApp conversations, messages and response cycles. Task
  counts remain current operational totals.
</p>
                </div>
              </div>
            </div>
            </div>
)}
      </div>

<style jsx global>{`
  @media print {
    @page {
      size: A4 landscape;
      margin: 8mm;
    }

    html,
    body {
      width: 100%;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    aside,
    header,
    .no-print {
      display: none !important;
    }

    main {
      padding: 0 !important;
      margin: 0 !important;
      background: white !important;
    }

    #report-print-area {
      padding: 0 !important;
      margin: 0 !important;
      background: white !important;
    }

    #report-print-area > div {
      margin-bottom: 10px !important;
    }

    .print-section {
      break-inside: avoid-page !important;
      page-break-inside: avoid !important;
      -webkit-column-break-inside: avoid !important;
      page-break-before: auto;
      overflow: visible !important;
    }

    .print-page {
      break-before: page !important;
      page-break-before: always !important;
    }

    #report-print-area .grid {
      display: grid !important;
    }

    #report-print-area .rounded-2xl {
      border-radius: 10px !important;
    }

    #report-print-area .shadow-sm,
    #report-print-area .shadow,
    #report-print-area .shadow-xl,
    #report-print-area .shadow-2xl {
      box-shadow: none !important;
    }

    #report-print-area .ring-1 {
      box-shadow: 0 0 0 1px #e2e8f0 !important;
    }

    #report-print-area table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 10px !important;
    }

    #report-print-area thead {
      display: table-header-group !important;
    }

    #report-print-area tr {
      break-inside: avoid-page !important;
      page-break-inside: avoid !important;
    }

    #report-print-area th,
    #report-print-area td {
      padding: 5px 7px !important;
      border-bottom: 1px solid #e2e8f0 !important;
      vertical-align: top !important;
    }

    #report-print-area h1 {
      font-size: 20px !important;
    }

    #report-print-area h2 {
      font-size: 14px !important;
    }

    #report-print-area p,
    #report-print-area span,
    #report-print-area td,
    #report-print-area th {
      line-height: 1.25 !important;
    }

    #report-print-area a {
      text-decoration: none !important;
      color: inherit !important;
    }

    #report-print-area button,
    #report-print-area select {
      display: none !important;
    }

    #report-print-area .xl\\:grid-cols-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }

    #report-print-area .xl\\:grid-cols-\\[1fr_1fr\\] {
      grid-template-columns: 1fr 1fr !important;
    }

    #report-print-area .xl\\:grid-cols-\\[1\\.2fr_0\\.8fr\\] {
      grid-template-columns: 1.2fr 0.8fr !important;
    }

    #report-print-area .xl\\:grid-cols-\\[0\\.9fr_1\\.1fr\\] {
      grid-template-columns: 0.9fr 1.1fr !important;
    }
  }
`}</style>
    </PageAccessGuard>

    </DashboardLayout>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "blue" | "green" | "orange" | "red";
}) {
  const colorClass =
    color === "blue"
      ? "text-blue-700"
      : color === "green"
      ? "text-green-700"
      : color === "orange"
      ? "text-orange-700"
      : color === "red"
      ? "text-red-700"
      : "text-slate-900";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className={`mt-2 truncate text-2xl font-extrabold ${colorClass}`}>
        {value}
      </h2>
    </div>
  );
}

function ReportCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="print-section rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BucketList({
  buckets,
  total,
}: {
  buckets: StatusBucket[];
  total: number;
}) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">No data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const pct = percentage(bucket.count, total);

        return (
          <div key={bucket.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-slate-700">
                {bucket.label}
              </p>
              <p className="text-sm font-bold text-slate-900">
                {bucket.count}
              </p>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="mt-1 text-xs text-slate-400">{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  total,
  description,
  color,
}: {
  label: string;
  value: number;
  total: number;
  description: string;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const pct = percentage(value, total);

  const colorClass =
    color === "blue"
      ? "bg-blue-600"
      : color === "green"
      ? "bg-green-600"
      : color === "orange"
      ? "bg-orange-500"
      : "bg-purple-600";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>

        <p className="text-lg font-extrabold text-slate-900">{value}</p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1 text-xs font-semibold text-slate-400">{pct}%</p>
    </div>
  );
}

function ConversionCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function TrendBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: "blue" | "green" | "purple";
}) {
  const width = Math.max(percentage(value, max), value > 0 ? 6 : 0);

  const colorClass =
    color === "blue"
      ? "bg-blue-500"
      : color === "green"
      ? "bg-green-500"
      : "bg-purple-500";

  return (
    <div className="mb-2 grid grid-cols-[80px_1fr_40px] items-center gap-3">
      <span className="text-xs font-semibold text-slate-500">{label}</span>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>

      <span className="text-right text-xs font-bold text-slate-700">
        {value}
      </span>
    </div>
  );
}