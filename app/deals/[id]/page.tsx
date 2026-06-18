"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type Deal = {
  id: number;
  company_id: number;
  lead_id: number | null;
  vehicle_id: number | null;
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
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  selected_bank_offer_id: number | null;
  selected_bank_name: string | null;
  finance_approved_amount: number | null;
  finance_interest_rate: number | null;
  finance_term_months: number | null;
  finance_balloon_percentage: number | null;
  finance_monthly_installment: number | null;
  finance_approval_expiry_date: string | null;
  prep_started_at: string | null;
  planned_delivery_at: string | null;
  ready_for_delivery_at: string | null;
  delivered_at: string | null;
};

type DealActivity = {
  id: number;
  company_id: number;
  deal_id: number;
  lead_id: number | null;
  vehicle_id: number | null;
  title: string;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string | null;
  is_required: boolean;
  is_system_managed: boolean;
};

type DealChecklistItem = {
  id: number;
  company_id: number;
  deal_id: number;
  title: string;
  category: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
  display_order: number | null;
  created_at: string | null;
  is_required: boolean;
  is_system_managed: boolean;
};

type DealDocument = {
  id: number;
  company_id: number | null;
  lead_id: number | null;
  deal_id: number | null;
  vehicle_id: number | null;
  customer_name: string | null;
  document_name: string | null;
  document_type: string | null;
  file_url: string | null;
  status: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string | null;
};

type DealLeadContact = {
  id: number;
  customer: string | null;
  phone: string | null;
  email: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  last_contacted_at?: string | null;
  last_contacted_by_id?: number | null;
  last_contacted_by_name?: string | null;
  last_contact_method?: string | null;
  last_contact_outcome?: string | null;
};

type CommunicationLog = {
  id: number;
  company_id: number;
  lead_id: number;
  deal_id: number | null;
  finance_application_id: number | null;
  channel: string;
  direction: string;
  template_key: string | null;
  subject: string | null;
  message_body: string | null;
  outcome: string | null;
  summary: string | null;
  send_status: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
  follow_up_task_id: number | null;
  created_at: string;
  sent_at: string | null;
  resolved_at: string | null;
};


const DEAL_STAGES = [
  "Draft",
  "Offer Sent",
  "Finance Submitted",
  "Finance Approved",
  "Sale Pending",
  "Ready for Delivery",
  "Delivered",
  "Lost",
];

const FINANCE_STATUSES = [
  "Not Started",
  "Documents Requested",
  "Submitted",
  "Approved",
  "Declined",
  "Paid Out",
];

const DEAL_DOCUMENT_TYPES = [
  "ID Copy",
  "Proof of Address",
  "Bank Statement",
  "Payslip",
  "Driver License",
  "Finance Application",
  "Signed OTP",
  "Invoice",
  "Contract",
  "Settlement Letter",
  "Trade-In Docs",
  "Delivery Handover",
  "Other",
];

const DEFAULT_CHECKLIST_ITEMS = [
  { title: "Finance approved", category: "Finance", isRequired: true, isSystemManaged: true },
  { title: "Customer documents verified", category: "Admin", isRequired: true, isSystemManaged: false },
  { title: "Deposit received", category: "Finance", isRequired: true, isSystemManaged: false },
  { title: "Invoice and contract prepared", category: "Admin", isRequired: true, isSystemManaged: false },
  { title: "Vehicle inspection and preparation completed", category: "Vehicle", isRequired: true, isSystemManaged: false },
  { title: "Roadworthy and licensing confirmed", category: "Vehicle", isRequired: true, isSystemManaged: false },
  { title: "Delivery date confirmed", category: "Delivery", isRequired: true, isSystemManaged: true },
  { title: "Customer handover completed", category: "Delivery", isRequired: true, isSystemManaged: true },
];

function formatRand(value: number | null | undefined) {
  if (!value && value !== 0) return "R -";

  return `R ${Number(value).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageBadge(stage: string | null) {
  const value = stage || "Draft";

  const styles: Record<string, string> = {
    Draft: "bg-slate-100 text-slate-700",
    "Offer Sent": "bg-blue-100 text-blue-700",
    "Finance Submitted": "bg-orange-100 text-orange-700",
    "Finance Approved": "bg-green-100 text-green-700",
    "Sale Pending": "bg-emerald-100 text-emerald-700",
    "Ready for Delivery": "bg-purple-100 text-purple-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Lost: "bg-red-100 text-red-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function financeBadge(status: string | null) {
  const value = status || "Not Started";

  const styles: Record<string, string> = {
    "Not Started": "bg-slate-100 text-slate-700",
    "Documents Requested": "bg-yellow-100 text-yellow-700",
    Submitted: "bg-orange-100 text-orange-700",
    Approved: "bg-green-100 text-green-700",
    Declined: "bg-red-100 text-red-700",
    "Paid Out": "bg-blue-100 text-blue-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function timelineDot(color: string | null) {
  const value = color || "blue";

  const styles: Record<string, string> = {
    blue: "bg-blue-500 ring-blue-100",
    green: "bg-green-500 ring-green-100",
    orange: "bg-orange-500 ring-orange-100",
    red: "bg-red-500 ring-red-100",
    purple: "bg-purple-500 ring-purple-100",
    slate: "bg-slate-500 ring-slate-100",
  };

  return styles[value] || "bg-blue-500 ring-blue-100";
}

function checklistCategoryBadge(category: string | null) {
  const value = category || "Delivery";

  const styles: Record<string, string> = {
    Finance: "bg-green-100 text-green-700",
    Admin: "bg-blue-100 text-blue-700",
    "Trade-In": "bg-orange-100 text-orange-700",
    Vehicle: "bg-purple-100 text-purple-700",
    Delivery: "bg-slate-100 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function getFileNameFromUrl(fileUrl: string | null) {
  if (!fileUrl) return "Document file";

  try {
    const url = new URL(fileUrl);
    const lastPart = url.pathname.split("/").pop();
    return lastPart ? decodeURIComponent(lastPart) : "Document file";
  } catch {
    const lastPart = fileUrl.split("/").pop();
    return lastPart || "Document file";
  }
}

function documentStatusBadge(status: string | null) {
  const value = status || "Pending";

  const styles: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Expired: "bg-slate-200 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function calculateNetDealValue(deal: Deal | null) {
  if (!deal) return 0;

  const sale = Number(deal.sale_price) || 0;
  const extras = Number(deal.extras_amount) || 0;
  const discount = Number(deal.discount_amount) || 0;
  const tradeIn = Number(deal.trade_in_value) || 0;
  const settlement = Number(deal.settlement_amount) || 0;

  return sale + extras - discount - tradeIn + settlement;
}


const COMMUNICATION_TEMPLATES = [
  { key: "follow_up", label: "Follow-up" },
  { key: "finance_documents_request", label: "Finance documents request" },
  { key: "finance_submitted_update", label: "Finance submitted update" },
  { key: "bank_approval_received", label: "Bank approval received" },
  { key: "vehicle_offer", label: "Vehicle offer" },
  { key: "delivery_confirmation", label: "Delivery confirmation" },
  { key: "custom", label: "Custom message" },
];

const COMMUNICATION_OUTCOMES = [
  "Sent",
  "Not Sent",
  "Customer Replied",
  "No Answer",
  "Interested",
  "Not Interested",
  "Documents Sent",
  "Documents Requested",
  "Callback Requested",
  "Delivery Confirmed",
  "Other",
];

function communicationStatusBadge(status: string | null) {
  const value = status || "Pending Outcome";

  const styles: Record<string, string> = {
    "Pending Outcome": "bg-orange-100 text-orange-700",
    "Sent Manually": "bg-green-100 text-green-700",
    "Not Sent": "bg-slate-100 text-slate-700",
    "Customer Replied": "bg-blue-100 text-blue-700",
    "No Answer": "bg-red-100 text-red-700",
    "Follow-up Created": "bg-purple-100 text-purple-700",
    Closed: "bg-slate-100 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function communicationChannelIcon(channel: string | null) {
  if (channel === "Message") return "📝";
  if (channel === "Email") return "✉️";
  if (channel === "Call") return "📞";
  return "📝";
}

function normalizePhoneForCommunication(value: string | null | undefined) {
  if (!value) return "";

  let cleaned = value.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = `27${cleaned.slice(1)}`;
  }

  if (cleaned.length === 9 && !cleaned.startsWith("27")) {
    cleaned = `27${cleaned}`;
  }

  return cleaned;
}

function buildCommunicationTemplate(args: {
  templateKey: string;
  channel: "Message" | "Email";
  customerName: string | null;
  vehicleName: string | null;
  salespersonName: string;
  selectedBankName?: string | null;
  monthlyInstallment?: number | null;
  deliveryDate?: string | null;
}) {
  const customerFirstName =
    (args.customerName || "there").split(" ")[0] || "there";
  const vehicle = args.vehicleName || "the vehicle";

  let subject = `DealFlow update for ${args.customerName || "customer"}`;
  let body = "";

  if (args.templateKey === "finance_documents_request") {
    subject = "Finance documents required";
    body = `Hi ${customerFirstName}, to continue with your finance application, please send your ID copy, proof of address, latest payslip and latest bank statements.`;
  } else if (args.templateKey === "finance_submitted_update") {
    subject = "Finance application submitted";
    body = `Hi ${customerFirstName}, your finance application for ${vehicle} has been submitted. I will update you as soon as we receive feedback.`;
  } else if (args.templateKey === "bank_approval_received") {
    subject = "Finance approval received";
    body = `Hi ${customerFirstName}, good news. We received finance feedback${args.selectedBankName ? ` from ${args.selectedBankName}` : ""}${args.monthlyInstallment ? ` with an estimated installment of ${formatRand(args.monthlyInstallment)}` : ""}. Please let me know when you are available to discuss the offer.`;
  } else if (args.templateKey === "vehicle_offer") {
    subject = `Vehicle offer: ${vehicle}`;
    body = `Hi ${customerFirstName}, I wanted to share the details for ${vehicle}. Please let me know if you would like to proceed or if you want to look at another option.`;
  } else if (args.templateKey === "delivery_confirmation") {
    subject = "Delivery confirmation";
    body = `Hi ${customerFirstName}, your delivery for ${vehicle}${args.deliveryDate ? ` is planned for ${formatDateTime(args.deliveryDate)}` : " is being arranged"}. Please confirm if this still suits you.`;
  } else if (args.templateKey === "follow_up") {
    subject = "Follow-up";
    body = `Hi ${customerFirstName}, I am following up on your Deal for ${vehicle}. Please let me know if you need any further assistance.`;
  } else {
    subject = "Message from the dealership";
    body = `Hi ${customerFirstName}, `;
  }

  if (args.channel === "Email") {
    body = `${body}\n\nRegards,\n${args.salespersonName}`;
  }

  return { subject, body };
}

function buildDateTimeLocalTomorrowMorning() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T09:00`;
}

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();

  const dealId = Number(params.id);

  const [deal, setDeal] = useState<Deal | null>(null);

const [leadContact, setLeadContact] = useState<DealLeadContact | null>(null);
const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
const [showCommunicationModal, setShowCommunicationModal] = useState(false);
const [communicationChannel, setCommunicationChannel] =
  useState<"Message" | "Email">("Email");
const [communicationTemplateKey, setCommunicationTemplateKey] =
  useState("follow_up");
const [communicationSubject, setCommunicationSubject] = useState("");
const [communicationMessage, setCommunicationMessage] = useState("");
const [savingCommunication, setSavingCommunication] = useState(false);
const [activeCommunicationLog, setActiveCommunicationLog] =
  useState<CommunicationLog | null>(null);
const [showCommunicationOutcomeModal, setShowCommunicationOutcomeModal] =
  useState(false);
const [communicationOutcome, setCommunicationOutcome] = useState("Sent");
const [communicationSummary, setCommunicationSummary] = useState("");
const [communicationFollowUpRequired, setCommunicationFollowUpRequired] =
  useState(true);
const [communicationFollowUpDate, setCommunicationFollowUpDate] = useState("");

const [activities, setActivities] = useState<DealActivity[]>([]);
const [checklistItems, setChecklistItems] = useState<DealChecklistItem[]>([]);
const [documents, setDocuments] = useState<DealDocument[]>([]);
const [documentType, setDocumentType] = useState("Invoice");
const [uploadingDocument, setUploadingDocument] = useState(false);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [workflowSaving, setWorkflowSaving] = useState(false);
const [submittingToFinance, setSubmittingToFinance] = useState(false);
const [plannedDeliveryAt, setPlannedDeliveryAt] = useState("");

  const [stageDraft, setStageDraft] = useState("Draft");
  const [financeDraft, setFinanceDraft] = useState("Not Started");
  const [notesDraft, setNotesDraft] = useState("");

  const netDealValue = useMemo(() => calculateNetDealValue(deal), [deal]);

  const completedChecklistItems = checklistItems.filter(
    (item) => item.is_completed
  ).length;

  const checklistProgress =
    checklistItems.length > 0
      ? Math.round((completedChecklistItems / checklistItems.length) * 100)
      : 0;

  const requiredPreDeliveryItems = checklistItems.filter(
    (item) =>
      item.is_required &&
      item.title.toLowerCase() !==
        "customer handover completed"
  );

  const outstandingRequiredItems = requiredPreDeliveryItems.filter(
    (item) => !item.is_completed
  );

  const isReadyForDelivery =
    Boolean(deal?.planned_delivery_at) &&
    requiredPreDeliveryItems.length > 0 &&
    outstandingRequiredItems.length === 0;

  async function fetchDeal() {
    if (!profile?.company_id || !dealId) return;

    setLoading(true);

    let query = supabase
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .eq("company_id", profile.company_id);

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error("Error loading deal:", error.message);
      setDeal(null);
      setLoading(false);
      return;
    }

    setDeal(data);
    setStageDraft(data.deal_stage || "Draft");
    setFinanceDraft(data.finance_status || "Not Started");
    setNotesDraft(data.notes || "");
    setPlannedDeliveryAt(
      data.planned_delivery_at
        ? new Date(data.planned_delivery_at)
            .toISOString()
            .slice(0, 16)
        : ""
    );

    if (data.lead_id) {
      await fetchLeadContact(data.lead_id);
    } else {
      setLeadContact(null);
    }

    setLoading(false);
  }

  async function fetchDealActivities() {
    if (!profile?.company_id || !dealId) return;

    const { data, error } = await supabase
      .from("deal_activities")
      .select("*")
      .eq("deal_id", dealId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading deal activities:", error.message);
      setActivities([]);
      return;
    }

    setActivities(Array.isArray(data) ? data : []);
  }

async function fetchDealDocuments() {
  if (!profile?.company_id || !dealId) return;

  const { data, error } = await supabase
    .from("finance_documents")
    .select("*")
    .eq("deal_id", dealId)
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading deal documents:", error.message);
    setDocuments([]);
    return;
  }

  setDocuments(Array.isArray(data) ? data : []);
}

  async function seedDefaultChecklistItems() {
  if (!profile?.company_id || !dealId) return;

  const payload = DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
    company_id: profile.company_id,
    deal_id: dealId,
    title: item.title,
    category: item.category,
    is_completed: false,
    display_order: index + 1,
    is_required: item.isRequired,
    is_system_managed: item.isSystemManaged,
  }));

  const { error } = await supabase
    .from("deal_checklist_items")
    .upsert(payload, {
      onConflict: "company_id,deal_id,title",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error("Error seeding deal checklist:", error.message);
  }
}

  async function fetchChecklistItems() {
    if (!profile?.company_id || !dealId) return;

    const { data, error } = await supabase
      .from("deal_checklist_items")
      .select("*")
      .eq("deal_id", dealId)
      .eq("company_id", profile.company_id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading deal checklist:", error.message);
      setChecklistItems([]);
      return;
    }

    if (!data || data.length === 0) {
      await seedDefaultChecklistItems();

      const { data: seededData, error: seededError } = await supabase
        .from("deal_checklist_items")
        .select("*")
        .eq("deal_id", dealId)
        .eq("company_id", profile.company_id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (seededError) {
        console.error("Error loading seeded checklist:", seededError.message);
        setChecklistItems([]);
        return;
      }

      setChecklistItems(Array.isArray(seededData) ? seededData : []);
      return;
    }

    setChecklistItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
  fetchDeal();
  fetchDealActivities();
  fetchChecklistItems();
  fetchDealDocuments();
  fetchCommunicationLogs();
}, [profile?.company_id, profile?.role, profile?.id, dealId]);

  async function addDealActivity(
    title: string,
    description: string,
    color: string
  ) {
    if (!profile?.company_id || !deal) return;

    const { error } = await supabase.from("deal_activities").insert({
      company_id: profile.company_id,
      deal_id: deal.id,
      lead_id: deal.lead_id,
      vehicle_id: deal.vehicle_id,
      title,
      description,
      activity_type: "deal",
      color,
    });

    if (error) {
      console.error("Error saving deal activity:", error.message);
    }
  }

  async function addLeadActivity(
    title: string,
    description: string,
    color: string
  ) {
    if (!profile?.company_id || !deal?.lead_id) return;

    const { error } = await supabase.from("lead_activities").insert({
      lead_id: deal.lead_id,
      title,
      description,
      activity_type: "deal",
      color,
      company_id: profile.company_id,
    });

    if (error) {
      console.error("Error saving lead activity:", error.message);
    }
  }



  async function fetchLeadContact(leadId: number) {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, customer, phone, email, assigned_user_id, assigned_user_name, last_contacted_at, last_contacted_by_id, last_contacted_by_name, last_contact_method, last_contact_outcome"
      )
      .eq("company_id", profile.company_id)
      .eq("id", leadId)
      .maybeSingle();

    if (error) {
      console.error("Error loading deal lead contact:", error.message);
      setLeadContact(null);
      return;
    }

    setLeadContact((data as DealLeadContact | null) || null);
  }

  async function fetchCommunicationLogs() {
    if (!profile?.company_id || !dealId) return;

    const { data, error } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading deal communication logs:", error.message);
      setCommunicationLogs([]);
      return;
    }

    setCommunicationLogs(Array.isArray(data) ? data : []);
  }

  function openCommunicationModal(
    channel: "Message" | "Email",
    templateKey = "follow_up"
  ) {
    if (!deal) return;

    const template = buildCommunicationTemplate({
      templateKey,
      channel,
      customerName: deal.customer_name || leadContact?.customer || null,
      vehicleName: deal.vehicle_name,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        leadContact?.assigned_user_name ||
        "Sales",
      selectedBankName: deal.selected_bank_name,
      monthlyInstallment: deal.finance_monthly_installment,
      deliveryDate: deal.planned_delivery_at,
    });

    setCommunicationChannel(channel);
    setCommunicationTemplateKey(templateKey);
    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
    setShowCommunicationModal(true);
  }

  function handleCommunicationTemplateChange(templateKey: string) {
    if (!deal) return;

    setCommunicationTemplateKey(templateKey);

    const template = buildCommunicationTemplate({
      templateKey,
      channel: communicationChannel,
      customerName: deal.customer_name || leadContact?.customer || null,
      vehicleName: deal.vehicle_name,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        leadContact?.assigned_user_name ||
        "Sales",
      selectedBankName: deal.selected_bank_name,
      monthlyInstallment: deal.finance_monthly_installment,
      deliveryDate: deal.planned_delivery_at,
    });

    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
  }

  async function startCommunicationAction() {
    if (!deal || !deal.lead_id || !profile?.company_id || !profile?.id) return;

    const customerPhone = normalizePhoneForCommunication(leadContact?.phone);
    const customerEmail = leadContact?.email || "";

    if (communicationChannel === "Message" && !customerPhone) {
      alert("Customer phone number is missing on the linked Lead.");
      return;
    }

    if (communicationChannel === "Email" && !customerEmail) {
      alert("Customer email address is missing on the linked Lead.");
      return;
    }

    if (!communicationMessage.trim()) {
      alert("Please enter a message.");
      return;
    }

    setSavingCommunication(true);

    try {
      const { data, error } = await supabase
        .from("communication_logs")
        .insert({
          company_id: profile.company_id,
          lead_id: deal.lead_id,
          deal_id: deal.id,
          finance_application_id: null,
          channel: communicationChannel,
          direction: "Outbound",
          template_key: communicationTemplateKey,
          subject:
            communicationChannel === "Email"
              ? communicationSubject.trim()
              : null,
          message_body: communicationMessage.trim(),
          outcome: null,
          summary: null,
          send_status: "Pending Outcome",
          customer_name: deal.customer_name || leadContact?.customer,
          customer_phone: leadContact?.phone,
          customer_email: leadContact?.email,
          created_by_id: profile.id,
          created_by_name:
            profile.full_name || profile.email || "Unknown User",
        })
        .select("*")
        .single();

      if (error || !data) {
        alert(
          "Could not create the communication action: " +
            (error?.message || "Unknown error")
        );
        return;
      }

      setActiveCommunicationLog(data);
      setCommunicationOutcome("Sent");
      setCommunicationSummary("");
      setCommunicationFollowUpRequired(true);
      setCommunicationFollowUpDate(buildDateTimeLocalTomorrowMorning());

      if (communicationChannel === "Message") {
        alert("Messaging channel is disabled for MVP1. Use Email Assist or Call instead.");
        return;
      }

      {
        window.location.href = `mailto:${encodeURIComponent(
          customerEmail
        )}?subject=${encodeURIComponent(
          communicationSubject.trim() || "DealFlow message"
        )}&body=${encodeURIComponent(communicationMessage.trim())}`;
      }

      await addDealActivity(
        `${communicationChannel} Action Started`,
        [
          `Template: ${COMMUNICATION_TEMPLATES.find((item) => item.key === communicationTemplateKey)?.label || communicationTemplateKey}`,
          "Status: Pending Outcome",
          communicationChannel === "Email"
            ? `Subject: ${communicationSubject.trim() || "-"}`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        "orange"
      );

      await addLeadActivity(
        `${communicationChannel} Action Started`,
        `Deal #${deal.id} communication action started. Status: Pending Outcome.`,
        "orange"
      );

      setShowCommunicationModal(false);
      setShowCommunicationOutcomeModal(true);
      await fetchCommunicationLogs();
      await fetchDealActivities();
    } finally {
      setSavingCommunication(false);
    }
  }

  async function resolveCommunicationOutcome() {
    if (!activeCommunicationLog || !deal || !deal.lead_id || !profile?.company_id || !profile?.id) {
      return;
    }

    if (!communicationOutcome) {
      alert("Please select an outcome.");
      return;
    }

    if (communicationFollowUpRequired && !communicationFollowUpDate) {
      alert("Please select a follow-up date.");
      return;
    }

    setSavingCommunication(true);

    try {
      let followUpTaskId: number | null = null;
      let finalStatus =
        communicationOutcome === "Sent"
          ? "Sent Manually"
          : communicationOutcome === "No Answer"
          ? "No Answer"
          : communicationOutcome === "Customer Replied"
          ? "Customer Replied"
          : communicationOutcome === "Not Sent"
          ? "Not Sent"
          : "Closed";

      if (communicationFollowUpRequired && communicationFollowUpDate) {
        const { data, error } = await supabase.rpc(
          "upsert_workflow_task",
          {
            p_lead_id: deal.lead_id,
            p_assigned_user_id:
              leadContact?.assigned_user_id || deal.assigned_user_id || profile.id,
            p_title:
              `Follow up after ${activeCommunicationLog.channel}: ${deal.customer_name || "Customer"}`,
            p_description:
              communicationSummary.trim() ||
              `Follow up on ${activeCommunicationLog.channel} communication for Deal #${deal.id}.`,
            p_task_type: "Follow-up",
            p_priority: "Medium",
            p_due_date: new Date(communicationFollowUpDate).toISOString(),
            p_task_scope: "Sales",
            p_task_reason:
              activeCommunicationLog.channel === "Message"
                ? "WHATSAPP_FOLLOW_UP"
                : activeCommunicationLog.channel === "Email"
                ? "EMAIL_FOLLOW_UP"
                : "COMMUNICATION_FOLLOW_UP",
            p_related_record_type: "lead",
            p_related_record_id: deal.lead_id,
            p_use_dedupe: true,
          }
        );

        if (error) {
          alert(
            "Outcome saved failed because follow-up task could not be created: " +
              error.message
          );
          return;
        }

        const result = Array.isArray(data) ? data[0] : data;
        followUpTaskId = result?.task_id || null;
        finalStatus = "Follow-up Created";
      }

      const { error } = await supabase
        .from("communication_logs")
        .update({
          outcome: communicationOutcome,
          summary: communicationSummary.trim() || null,
          send_status: finalStatus,
          follow_up_task_id: followUpTaskId,
          sent_at:
            finalStatus === "Sent Manually" ||
            finalStatus === "Follow-up Created"
              ? new Date().toISOString()
              : activeCommunicationLog.sent_at,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", activeCommunicationLog.id)
        .eq("company_id", profile.company_id);

      if (error) {
        alert("Could not update communication outcome: " + error.message);
        return;
      }

      await addDealActivity(
        `${activeCommunicationLog.channel} Outcome Logged`,
        [
          `Outcome: ${communicationOutcome}`,
          communicationSummary.trim()
            ? `Summary: ${communicationSummary.trim()}`
            : null,
          followUpTaskId
            ? `Follow-up task created for ${new Date(
                communicationFollowUpDate
              ).toLocaleString("en-ZA")}`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        finalStatus === "Not Sent" || finalStatus === "No Answer"
          ? "orange"
          : "green"
      );

      await addLeadActivity(
        `${activeCommunicationLog.channel} Outcome Logged`,
        `Deal #${deal.id} communication outcome: ${communicationOutcome}.`,
        finalStatus === "Not Sent" || finalStatus === "No Answer"
          ? "orange"
          : "green"
      );

      await Promise.all([
        fetchCommunicationLogs(),
        fetchDeal(),
        fetchDealActivities(),
      ]);

      window.dispatchEvent(new CustomEvent("dealflow-task-updated"));

      setShowCommunicationOutcomeModal(false);
      setActiveCommunicationLog(null);
      setCommunicationOutcome("Sent");
      setCommunicationSummary("");
      setCommunicationFollowUpRequired(false);
      setCommunicationFollowUpDate("");
    } finally {
      setSavingCommunication(false);
    }
  }

  function openCommunicationFallback() {
    if (!activeCommunicationLog) return;

    if (activeCommunicationLog.channel === "Message") {
      const phone = normalizePhoneForCommunication(activeCommunicationLog.customer_phone);

      if (!phone) return;

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(
          activeCommunicationLog.message_body || ""
        )}`,
        "_blank"
      );
      return;
    }

    if (activeCommunicationLog.channel === "Email") {
      window.location.href = `mailto:${encodeURIComponent(
        activeCommunicationLog.customer_email || ""
      )}?subject=${encodeURIComponent(
        activeCommunicationLog.subject || "DealFlow message"
      )}&body=${encodeURIComponent(activeCommunicationLog.message_body || "")}`;
    }
  }

  function openManualOutcomeModal() {
    setActiveCommunicationLog(null);
    setCommunicationChannel("Email");
    setCommunicationTemplateKey("manual_outcome");
    setCommunicationSubject("");
    setCommunicationMessage("");
    setCommunicationOutcome("Customer Replied");
    setCommunicationSummary("");
    setCommunicationFollowUpRequired(false);
    setCommunicationFollowUpDate(buildDateTimeLocalTomorrowMorning());
    setShowCommunicationOutcomeModal(true);
  }

  async function saveManualCommunicationOutcome() {
    if (!deal || !deal.lead_id || !profile?.company_id || !profile?.id) return;

    if (!communicationOutcome) {
      alert("Please select an outcome.");
      return;
    }

    setSavingCommunication(true);

    try {
      const { data, error } = await supabase.rpc(
        "resolve_manual_communication_outcome",
        {
          p_lead_id: deal.lead_id,
          p_channel: communicationChannel,
          p_outcome: communicationOutcome,
          p_summary: communicationSummary.trim() || null,
          p_subject:
            communicationChannel === "Email"
              ? communicationSubject.trim() || null
              : null,
          p_message_body: communicationMessage.trim() || null,
          p_deal_id: deal.id,
          p_finance_application_id: null,
        }
      );

      if (error) {
        alert("Could not save communication outcome: " + error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      await addDealActivity(
        `${communicationChannel} Outcome Logged`,
        [
          `Outcome: ${communicationOutcome}`,
          communicationSummary.trim()
            ? `Summary: ${communicationSummary.trim()}`
            : null,
          result?.resolved_existing
            ? "Resolved previous pending communication action"
            : "Standalone communication outcome logged",
          result?.completed_task_id
            ? "Linked follow-up task completed"
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        "green"
      );

      await addLeadActivity(
        `${communicationChannel} Outcome Logged`,
        `Deal #${deal.id} manual communication outcome: ${communicationOutcome}. ${
          result?.resolved_existing
            ? "Previous pending communication action was resolved."
            : "Standalone outcome logged."
        } ${
          result?.completed_task_id
            ? "Linked follow-up task completed."
            : ""
        }`,
        "green"
      );

      await Promise.all([
        fetchCommunicationLogs(),
        fetchDeal(),
        fetchDealActivities(),
      ]);

      window.dispatchEvent(new CustomEvent("dealflow-task-updated"));

      setShowCommunicationOutcomeModal(false);
      setCommunicationOutcome("Sent");
      setCommunicationSummary("");
      setCommunicationFollowUpRequired(false);
      setCommunicationFollowUpDate("");
    } finally {
      setSavingCommunication(false);
    }
  }

  async function saveDealUpdates() {
    if (!profile?.company_id || !deal) return;

    setSaving(true);

    const oldStage = deal.deal_stage || "Draft";
    const oldFinance = deal.finance_status || "Not Started";

    const { error } = await supabase
      .from("deals")
      .update({
        deal_stage: deal.deal_stage,
        finance_status: deal.finance_status,
        notes: notesDraft.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error updating deal: " + error.message);
      setSaving(false);
      return;
    }

    const changes: string[] = [];

    if (oldStage !== stageDraft) {
      changes.push(`Stage changed from ${oldStage} to ${stageDraft}`);
    }

    if (oldFinance !== financeDraft) {
      changes.push(`Finance changed from ${oldFinance} to ${financeDraft}`);
    }

    if (changes.length === 0) {
      changes.push("Deal notes/details were updated");
    }

    await addDealActivity(
      "Deal Updated",
      changes.join(". ") + ".",
      stageDraft === "Delivered"
        ? "green"
        : stageDraft === "Lost"
        ? "red"
        : financeDraft === "Approved"
        ? "green"
        : "blue"
    );

    await addLeadActivity(
      "Deal Updated",
      `Deal #${deal.id} for ${deal.vehicle_name || "vehicle"} was updated. ${
        changes.join(". ") || ""
      }`,
      "blue"
    );

    setSaving(false);
    await fetchDeal();
    await fetchDealActivities();
  }

  async function quickSetStage(newStage: string) {
    setStageDraft(newStage);
  }

async function uploadDealDocument(file: File) {
  if (!profile?.company_id || !deal) return;

  if (!documentType.trim()) {
    alert("Please select a document type.");
    return;
  }

  setUploadingDocument(true);

  try {
    const fileExt = file.name.includes(".")
      ? file.name.split(".").pop()
      : "file";

    const safeCustomer = (deal.customer_name || "customer")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    const safeDocType = documentType
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    const fileName = `${safeDocType}-${Date.now()}.${fileExt}`;
    const filePath = `${profile.company_id}/deals/${deal.id}/${safeCustomer}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("finance-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      alert("Document upload failed: " + uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("finance-documents").getPublicUrl(filePath);

    const { error: insertError } = await supabase
      .from("finance_documents")
      .insert({
        company_id: profile.company_id,
        lead_id: deal.lead_id,
        deal_id: deal.id,
        vehicle_id: deal.vehicle_id,
        customer_name: deal.customer_name,
        document_name: file.name,
        document_type: documentType,
        file_url: publicUrl,
        status: "Pending",
        uploaded_by: profile.full_name || profile.email || "Unknown User",
        uploaded_by_name: profile.full_name || profile.email || "Unknown User",
      });

    if (insertError) {
      alert(
        "Document uploaded, but failed to save record: " +
          insertError.message
      );
      return;
    }

    await addDealActivity(
      "Deal Document Uploaded",
      `${documentType} uploaded for ${deal.customer_name || "customer"}.`,
      "blue"
    );

    await addLeadActivity(
      "Deal Document Uploaded",
      `${documentType} uploaded from Deal #${deal.id}.`,
      "blue"
    );

    await fetchDealDocuments();
    await fetchDealActivities();

    alert("Deal document uploaded successfully.");
  } catch (error) {
    console.error("Error uploading deal document:", error);
    alert("Unexpected error uploading deal document.");
  } finally {
    setUploadingDocument(false);
  }
}

  async function toggleChecklistItem(item: DealChecklistItem) {
    if (!profile?.company_id || !deal) return;

    if (item.is_system_managed) {
      alert("This checklist item is updated automatically by the workflow.");
      return;
    }

    const newValue = !item.is_completed;

    const { error } = await supabase
      .from("deal_checklist_items")
      .update({
        is_completed: newValue,
        completed_at: newValue ? new Date().toISOString() : null,
      })
      .eq("id", item.id)
      .eq("company_id", profile.company_id)
      .eq("deal_id", deal.id);

    if (error) {
      alert("Error updating checklist item: " + error.message);
      return;
    }

    await addDealActivity(
      newValue ? "Checklist Item Completed" : "Checklist Item Reopened",
      `${item.title} was ${newValue ? "completed" : "reopened"}.`,
      newValue ? "green" : "orange"
    );

    await fetchChecklistItems();
    await fetchDealActivities();
  }

  async function submitDealToFinance() {
    if (!deal?.lead_id || !profile?.company_id) return;

    if (
      deal.finance_status === "Submitted" ||
      deal.finance_status === "Approved" ||
      deal.selected_bank_offer_id
    ) {
      alert("This Deal has already been submitted to Finance.");
      return;
    }

    const confirmed = window.confirm(
      `Submit Deal #${deal.id} for ${deal.customer_name || "this customer"} to Finance?`
    );

    if (!confirmed) return;

    setSubmittingToFinance(true);

    const { data, error } = await supabase.rpc(
      "submit_lead_to_finance",
      { p_lead_id: deal.lead_id }
    );

    setSubmittingToFinance(false);

    if (error) {
      alert("Could not submit to Finance: " + error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    await Promise.all([
      fetchDeal(),
      fetchDealActivities(),
    ]);

    alert(
      result?.result_action === "already_exists"
        ? "This customer was already submitted to Finance."
        : "Deal submitted to Finance successfully."
    );
  }

  async function runDealWorkflow(
    functionName:
      | "start_deal_vehicle_preparation"
      | "mark_deal_ready_for_delivery"
      | "complete_deal_delivery",
    successMessage: string
  ) {
    if (!deal) return;

    setWorkflowSaving(true);

    const { error } = await supabase.rpc(
      functionName,
      { p_deal_id: deal.id }
    );

    setWorkflowSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await Promise.all([
      fetchDeal(),
      fetchChecklistItems(),
      fetchDealActivities(),
    ]);

    alert(successMessage);
  }

  async function savePlannedDeliveryDate() {
    if (!deal || !plannedDeliveryAt) {
      alert("Please select the planned delivery date and time.");
      return;
    }

    setWorkflowSaving(true);

    const { error } = await supabase.rpc(
      "set_deal_delivery_date",
      {
        p_deal_id: deal.id,
        p_planned_delivery_at: new Date(
          plannedDeliveryAt
        ).toISOString(),
      }
    );

    setWorkflowSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await Promise.all([
      fetchDeal(),
      fetchChecklistItems(),
      fetchDealActivities(),
    ]);

    alert("Delivery date saved successfully.");
  }

  async function markReadyForDelivery() {
    await runDealWorkflow(
      "mark_deal_ready_for_delivery",
      "The Deal and vehicle are now Ready for Delivery."
    );
  }

  async function completeDelivery() {
    const confirmed = window.confirm(
      "Confirm that the customer handover is complete and the vehicle has been delivered?"
    );

    if (!confirmed) return;

    await runDealWorkflow(
      "complete_deal_delivery",
      "Delivery completed. The Deal, Lead and vehicle were updated."
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading deal details...
        </div>
      </DashboardLayout>
    );
  }

  if (!deal) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Deal not found
          </h1>
          <p className="mt-2 text-slate-500">
            This deal could not be found or you do not have access to it.
          </p>
          <button
            onClick={() => router.push("/deals")}
            className="mt-5 rounded-xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Deals
          </button>
        </div>
      </DashboardLayout>
    );
  }

return (
  <DashboardLayout>
    <PageAccessGuard module="deals">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link
              href="/deals"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              ← Back to Deals
            </Link>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">
                Deal #{deal.id}
              </h1>

              <span
                className={`${stageBadge(
                  deal.deal_stage
                )} rounded-full px-3 py-1 text-xs font-extrabold`}
              >
                {deal.deal_stage || "Draft"}
              </span>

              <span
                className={`${financeBadge(
                  deal.finance_status
                )} rounded-full px-3 py-1 text-xs font-extrabold`}
              >
                {deal.finance_status || "Not Started"}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {deal.customer_name || "Unknown customer"} •{" "}
              {deal.vehicle_name || "No vehicle captured"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {deal.lead_id && (
              <Link
                href={`/leads/${deal.lead_id}`}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Open Lead
              </Link>
            )}

            {deal.vehicle_id && (
              <Link
                href={`/inventory/${deal.vehicle_id}`}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Open Vehicle
              </Link>
            )}
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
        >
          <MetricCard label="Net Deal Value" value={formatRand(netDealValue)} />
          <MetricCard label="Sale Price" value={formatRand(deal.sale_price)} />
          <MetricCard label="Deposit" value={formatRand(deal.deposit_amount)} />
          <MetricCard
            label="Checklist"
            value={`${completedChecklistItems}/${checklistItems.length}`}
          />
          <MetricCard label="Progress" value={`${checklistProgress}%`} />
        </div>



        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Deal Communication Assist
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Send deal-stage email messages and track pending outcomes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={() => openCommunicationModal("Email", "follow_up")}
                disabled={!deal.lead_id}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send Email
              </button>

              <button
                type="button"
                onClick={openManualOutcomeModal}
                disabled={!deal.lead_id}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Log Reply / Outcome
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">
                Last Contact
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Method" value={leadContact?.last_contact_method || "Not captured"} />
                <Info label="Outcome" value={leadContact?.last_contact_outcome || "Not captured"} />
                <Info label="By" value={leadContact?.last_contacted_by_name || "Not captured"} />
                <Info label="When" value={formatDateTime(leadContact?.last_contacted_at)} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">
                  Recent Deal Communication
                </p>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                  {
                    communicationLogs.filter(
                      (log) => (log.send_status || "") === "Pending Outcome"
                    ).length
                  } Pending
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {communicationLogs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                    No deal communication logged yet.
                  </p>
                ) : (
                  communicationLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {communicationChannelIcon(log.channel)} {log.channel} • {log.direction}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {log.summary || log.subject || log.message_body || "No summary captured"}
                          </p>
                        </div>
                        <span
                          className={`${communicationStatusBadge(
                            log.send_status
                          )} rounded-full px-2 py-1 text-[11px] font-bold`}
                        >
                          {log.send_status || "Pending Outcome"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {formatDateTime(log.created_at)} • {log.created_by_name || "Unknown user"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              Sale and Delivery Workflow
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Move the selected vehicle through preparation, delivery readiness and customer handover.
            </p>

            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-orange-900">
                    Finance Submission
                  </p>
                  <p className="mt-1 text-sm text-orange-700">
                    Submit this Deal to Finance when the customer and Deal values are ready.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void submitDealToFinance()}
                  disabled={
                    submittingToFinance ||
                    !deal.lead_id ||
                    deal.finance_status === "Submitted" ||
                    deal.finance_status === "Approved" ||
                    Boolean(deal.selected_bank_offer_id)
                  }
                  className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingToFinance
                    ? "Submitting..."
                    : deal.finance_status === "Submitted" ||
                      deal.finance_status === "Approved" ||
                      deal.selected_bank_offer_id
                    ? "Finance Submitted"
                    : "Submit to Finance"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  void runDealWorkflow(
                    "start_deal_vehicle_preparation",
                    "Vehicle preparation started."
                  )
                }
                disabled={
                  workflowSaving ||
                  !deal.selected_bank_offer_id ||
                  deal.deal_stage === "Delivered" ||
                  deal.deal_stage === "Lost"
                }
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Vehicle Preparation
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-700">Preparation started</p>
                <p className="mt-1 text-slate-500">
                  {formatDateTime(deal.prep_started_at)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-200 bg-purple-50 p-4">
              <label className="text-sm font-semibold text-purple-900">
                Planned Delivery Date and Time
              </label>

              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="datetime-local"
                  value={plannedDeliveryAt}
                  onChange={(event) =>
                    setPlannedDeliveryAt(event.target.value)
                  }
                  disabled={
                    workflowSaving ||
                    deal.deal_stage === "Delivered"
                  }
                  className="rounded-xl border border-purple-200 bg-white p-3 text-sm"
                />

                <button
                  type="button"
                  onClick={() => void savePlannedDeliveryDate()}
                  disabled={
                    workflowSaving ||
                    !plannedDeliveryAt ||
                    deal.deal_stage === "Delivered"
                  }
                  className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  Save Delivery Date
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-bold text-slate-900">
                Required pre-delivery checks
              </p>

              {outstandingRequiredItems.length === 0 ? (
                <p className="mt-2 text-sm font-semibold text-green-700">
                  All required pre-delivery items are complete.
                </p>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-orange-700">
                    {outstandingRequiredItems.length} required item
                    {outstandingRequiredItems.length === 1 ? "" : "s"} outstanding:
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {outstandingRequiredItems
                      .map((item) => item.title)
                      .join(" • ")}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void markReadyForDelivery()}
                disabled={
                  workflowSaving ||
                  !isReadyForDelivery ||
                  deal.deal_stage === "Delivered"
                }
                className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Ready for Delivery
              </button>

              <button
                type="button"
                onClick={() => void completeDelivery()}
                disabled={
                  workflowSaving ||
                  deal.deal_stage !== "Ready for Delivery"
                }
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete Customer Handover
              </button>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <label className="text-sm font-medium text-slate-600">
                Deal Notes
              </label>

              <textarea
                value={notesDraft}
                onChange={(event) =>
                  setNotesDraft(event.target.value)
                }
                className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm"
                placeholder="Preparation notes, customer instructions or delivery comments..."
              />

              <button
                type="button"
                onClick={saveDealUpdates}
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Deal Summary</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Customer" value={deal.customer_name} />
              <Info label="Vehicle" value={deal.vehicle_name} />
              <Info label="Current Stage" value={deal.deal_stage || "Draft"} />
              <Info
                label="Finance Status"
                value={deal.finance_status || "Not Started"}
              />
              <Info label="Created" value={formatDateTime(deal.created_at)} />
              <Info label="Last Updated" value={formatDateTime(deal.updated_at)} />
              <Info
                label="Planned Delivery"
                value={formatDateTime(deal.planned_delivery_at)}
              />
              <Info
                label="Ready Since"
                value={formatDateTime(deal.ready_for_delivery_at)}
              />
              <Info
                label="Delivered"
                value={formatDateTime(deal.delivered_at)}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {deal.lead_id ? (
                <Link
                  href={`/leads/${deal.lead_id}`}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Open Linked Lead
                </Link>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                  No linked lead
                </div>
              )}

              {deal.vehicle_id ? (
                <Link
                  href={`/inventory/${deal.vehicle_id}`}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Open Linked Vehicle
                </Link>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                  No linked vehicle
                </div>
              )}
            </div>
          </div>
        </div>

        {deal.selected_bank_offer_id && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                  Customer Selected Finance Offer
                </p>
                <h2 className="mt-1 text-xl font-bold text-emerald-950">
                  {deal.selected_bank_name || "Approved Bank"}
                </h2>
              </div>

              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                Sale Pending
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Approved Amount" value={formatRand(deal.finance_approved_amount)} />
              <Info
                label="Monthly Instalment"
                value={
                  deal.finance_monthly_installment !== null
                    ? `${formatRand(deal.finance_monthly_installment)} / month`
                    : "-"
                }
              />
              <Info
                label="Interest Rate"
                value={
                  deal.finance_interest_rate !== null
                    ? `${deal.finance_interest_rate}%`
                    : "-"
                }
              />
              <Info
                label="Term"
                value={
                  deal.finance_term_months
                    ? `${deal.finance_term_months} months`
                    : "-"
                }
              />
              <Info label="Deposit" value={formatRand(deal.deposit_amount)} />
              <Info
                label="Balloon"
                value={
                  deal.finance_balloon_percentage !== null
                    ? `${deal.finance_balloon_percentage}%`
                    : "-"
                }
              />
              <Info
                label="Approval Expiry"
                value={
                  deal.finance_approval_expiry_date
                    ? new Date(deal.finance_approval_expiry_date).toLocaleDateString("en-ZA")
                    : "-"
                }
              />
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Delivery Checklist
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Track all items required before customer handover.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Completion
                </p>
                <p className="text-xl font-extrabold text-slate-900">
                  {completedChecklistItems}/{checklistItems.length}
                </p>
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>

            <p className="mt-2 text-xs font-semibold text-slate-500">
              {checklistProgress}% complete
            </p>

            <div className="mt-5 space-y-3">
              {checklistItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition hover:bg-slate-50 ${
                    item.is_completed
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.is_completed)}
                    onChange={() => toggleChecklistItem(item)}
                    disabled={item.is_system_managed}
                    className="mt-1 h-5 w-5 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-bold ${
                          item.is_completed
                            ? "text-green-800 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {item.title}
                      </p>

                      <span
                        className={`${checklistCategoryBadge(
                          item.category
                        )} rounded-full px-2.5 py-1 text-[10px] font-bold`}
                      >
                        {item.category || "Delivery"}
                      </span>

                      {item.is_required ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
                          Required
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                          Optional
                        </span>
                      )}

                      {item.is_system_managed && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                          Automatic
                        </span>
                      )}
                    </div>

                    {item.completed_at && (
                      <p className="mt-1 text-xs text-green-700">
                        Completed {formatDateTime(item.completed_at)}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Checklist Status
              </h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Completed
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-green-700">
                    {completedChecklistItems}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Outstanding
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-orange-700">
                    {Math.max(checklistItems.length - completedChecklistItems, 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Delivery Readiness
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    {checklistProgress}%
                  </p>
                </div>
              </div>

              {checklistProgress === 100 ? (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-bold text-green-800">
                    Ready for delivery
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    All checklist items are complete.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-bold text-orange-800">
                    Not ready yet
                  </p>
                  <p className="mt-1 text-sm text-orange-700">
                    Complete the outstanding items before handover.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Finance Snapshot
              </h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Finance Status
                  </p>
                  <span
                    className={`${financeBadge(
                      deal.finance_status
                    )} mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold`}
                  >
                    {deal.finance_status || "Not Started"}
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Deposit
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-slate-950">
                    {formatRand(deal.deposit_amount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Finance Amount Estimate
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-blue-700">
                    {formatRand(
                      netDealValue - (Number(deal.deposit_amount) || 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

<div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div>
      <h2 className="text-lg font-bold text-slate-900">Deal Documents</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload and manage documents linked directly to this deal.
      </p>
    </div>

    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
      {documents.length} file{documents.length === 1 ? "" : "s"}
    </span>
  </div>

  <div className="mt-5 grid gap-3 md:grid-cols-[240px_1fr]">
    <select
      value={documentType}
      onChange={(e) => setDocumentType(e.target.value)}
      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
    >
      {DEAL_DOCUMENT_TYPES.map((type) => (
        <option key={type}>{type}</option>
      ))}
    </select>

    <label className="block cursor-pointer rounded-xl brand-primary-bg px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90">
      {uploadingDocument ? "Uploading Document..." : "Upload Deal Document"}

      <input
        type="file"
        className="hidden"
        disabled={uploadingDocument}
        onChange={async (e) => {
          const file = e.target.files?.[0];

          if (file) {
            await uploadDealDocument(file);
            e.target.value = "";
          }
        }}
      />
    </label>
  </div>

  <div className="mt-5">
    {documents.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">
          No deal documents uploaded yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Upload invoices, contracts, finance documents and handover documents here.
        </p>
      </div>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">
                  {doc.document_type || "Document"}
                </p>

                <p className="mt-1 truncate text-sm text-slate-500">
                  {doc.document_name || getFileNameFromUrl(doc.file_url)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Uploaded by{" "}
                  {doc.uploaded_by_name || doc.uploaded_by || "Unknown"}
                </p>

                <p className="text-xs text-slate-400">
                  {doc.created_at ? formatDateTime(doc.created_at) : ""}
                </p>
              </div>

              <span
                className={`${documentStatusBadge(
                  doc.status
                )} rounded-full px-3 py-1 text-xs font-bold`}
              >
                {doc.status || "Pending"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={doc.file_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                View
              </a>

              <a
                href={doc.file_url || "#"}
                download
                className="rounded-xl bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-green-500"
              >
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            Price Breakdown
          </h2>

          <div className="mt-5 space-y-3">
            <PriceRow label="Sale Price" value={formatRand(deal.sale_price)} />
            <PriceRow label="Extras" value={formatRand(deal.extras_amount)} />
            <PriceRow
              label="Discount"
              value={`- ${formatRand(deal.discount_amount)}`}
            />
            <PriceRow
              label="Trade-In Value"
              value={`- ${formatRand(deal.trade_in_value)}`}
            />
            <PriceRow
              label="Settlement Amount"
              value={formatRand(deal.settlement_amount)}
            />
            <div className="border-t border-slate-200 pt-3">
              <PriceRow
                label="Estimated Net Deal Value"
                value={formatRand(netDealValue)}
                strong
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Deal Activity Timeline
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Track stage, finance, checklist and notes updates for this deal.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {activities.length}
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No deal activity yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Stage, finance and checklist updates will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full ring-4 ${timelineDot(
                        activity.color
                      )}`}
                    />
                    <div className="mt-2 h-full w-px bg-slate-200" />
                  </div>

                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        {activity.title}
                      </h3>

                      <span className="text-xs font-medium text-slate-400">
                        {formatDateTime(activity.created_at)}
                      </span>
                    </div>

                    {activity.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {activity.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3">
                      {activity.lead_id && (
                        <Link
                          href={`/leads/${activity.lead_id}`}
                          className="text-xs font-bold text-blue-700 hover:underline"
                        >
                          Open related lead →
                        </Link>
                      )}

                      {activity.vehicle_id && (
                        <Link
                          href={`/inventory/${activity.vehicle_id}`}
                          className="text-xs font-bold text-slate-700 hover:underline"
                        >
                          Open related vehicle →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


{showCommunicationModal && deal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-slate-900">
        {communicationChannel} Assist
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Prepare the message, open the external app, then resolve the pending outcome in DealFlow.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-600">Channel</label>
          <select
            value={communicationChannel}
            onChange={(event) => {
              const channel = event.target.value as "Message" | "Email";
              setCommunicationChannel(channel);
              const template = buildCommunicationTemplate({
                templateKey: communicationTemplateKey,
                channel,
                customerName: deal.customer_name || leadContact?.customer || null,
                vehicleName: deal.vehicle_name,
                salespersonName: profile?.full_name || profile?.email || leadContact?.assigned_user_name || "Sales",
                selectedBankName: deal.selected_bank_name,
                monthlyInstallment: deal.finance_monthly_installment,
                deliveryDate: deal.planned_delivery_at,
              });
              setCommunicationSubject(template.subject);
              setCommunicationMessage(template.body);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            <option value="Email">Email</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-600">Template</label>
          <select
            value={communicationTemplateKey}
            onChange={(event) => handleCommunicationTemplateChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            {COMMUNICATION_TEMPLATES.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {communicationChannel === "Email" && (
        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-600">Subject</label>
          <input
            value={communicationSubject}
            onChange={(event) => setCommunicationSubject(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </div>
      )}

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate-600">Message</label>
        <textarea
          value={communicationMessage}
          onChange={(event) => setCommunicationMessage(event.target.value)}
          className="mt-1 min-h-40 w-full rounded-xl border border-slate-300 p-3"
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowCommunicationModal(false)}
          disabled={savingCommunication}
          className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void startCommunicationAction()}
          disabled={savingCommunication}
          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {savingCommunication ? "Opening..." : `Open ${communicationChannel}`}
        </button>
      </div>
    </div>
  </div>
)}

{showCommunicationOutcomeModal && deal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-slate-900">
        Resolve Communication Outcome
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        This keeps the Deal and linked Lead accurate even though the message was sent outside DealFlow.
      </p>

      {activeCommunicationLog && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          Pending outcome for {activeCommunicationLog.channel}. If the app did not open, use the fallback below.
          <button
            type="button"
            onClick={openCommunicationFallback}
            className="ml-2 font-bold underline"
          >
            Open fallback
          </button>
        </div>
      )}

      {!activeCommunicationLog && (
        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-600">Channel</label>
          <select
            value={communicationChannel}
            onChange={(event) => setCommunicationChannel(event.target.value as "Message" | "Email")}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            <option value="Email">Email</option>
          </select>
        </div>
      )}

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate-600">Outcome</label>
        <select
          value={communicationOutcome}
          onChange={(event) => setCommunicationOutcome(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 p-3"
        >
          {COMMUNICATION_OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate-600">Summary</label>
        <textarea
          value={communicationSummary}
          onChange={(event) => setCommunicationSummary(event.target.value)}
          placeholder="Example: Customer confirmed delivery date."
          className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3"
        />
      </div>

      {activeCommunicationLog && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={communicationFollowUpRequired}
              onChange={(event) => setCommunicationFollowUpRequired(event.target.checked)}
            />
            Create or update follow-up task
          </label>

          {communicationFollowUpRequired && (
            <input
              type="datetime-local"
              value={communicationFollowUpDate}
              onChange={(event) => setCommunicationFollowUpDate(event.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3"
            />
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setShowCommunicationOutcomeModal(false);
            setActiveCommunicationLog(null);
          }}
          disabled={savingCommunication}
          className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            activeCommunicationLog
              ? void resolveCommunicationOutcome()
              : void saveManualCommunicationOutcome()
          }
          disabled={savingCommunication}
          className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {savingCommunication ? "Saving..." : "Save Outcome"}
        </button>
      </div>
    </div>
  </div>
)}

          </PageAccessGuard>

    </DashboardLayout>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${
        strong ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"
      }`}
    >
      <span
        className={`text-sm font-medium ${
          strong ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}