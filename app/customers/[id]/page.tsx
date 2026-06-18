"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type LeadCustomer = {
  id: number;
  customer: string | null;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  status: string | null;
  finance: string | null;
  budget: string | null;
  source: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  company_id: number | null;
  created_at: string | null;
};

type Deal = {
  id: number;
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
  created_at: string | null;
};

type InventoryVehicle = {
  id: number;
  stock_code: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  colour: string | null;
  vin: string | null;
  registration_number: string | null;
  image_url: string | null;
  status: string | null;
  location: string | null;
  linked_lead_id: number | null;
  linked_customer_name: string | null;
};

type DocumentItem = {
  id: number;
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

type LeadTask = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_name: string | null;
};

type Activity = {
  id: number;
  lead_id: number;
  title: string;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string | null;
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
};

type FinanceApplication = {
  id: number;
  lead_id: number | null;
  customer: string | null;
  vehicle: string | null;
  requested_amount: number | null;
  deposit: number | null;
  monthly_budget: number | null;
  finance_status: string | null;
  bank: string | null;
  finance_notes: string | null;
  submitted_at: string | null;
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


function getInitials(name: string | null) {
  if (!name) return "C";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function statusBadge(status: string | null) {
  const value = status || "New Lead";

  const styles: Record<string, string> = {
    "New Lead": "bg-blue-100 text-blue-700",
    Contacted: "bg-orange-100 text-orange-700",
    Qualified: "bg-purple-100 text-purple-700",
    "Test Drive": "bg-yellow-100 text-yellow-700",
    Negotiation: "bg-orange-100 text-orange-700",
    Finance: "bg-indigo-100 text-indigo-700",
    Approved: "bg-green-100 text-green-700",
    Delivered: "bg-teal-100 text-teal-700",
    Lost: "bg-red-100 text-red-700",
    "Attempted Contact": "bg-blue-100 text-blue-700",
    "Submitted to Finance": "bg-orange-100 text-orange-700",
    "Deal Closed": "bg-green-100 text-green-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function dealStageBadge(stage: string | null) {
  const value = stage || "Draft";

  const styles: Record<string, string> = {
    Draft: "bg-slate-100 text-slate-700",
    "Offer Sent": "bg-blue-100 text-blue-700",
    "Finance Submitted": "bg-orange-100 text-orange-700",
    "Finance Approved": "bg-green-100 text-green-700",
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

function vehicleTitle(vehicle: InventoryVehicle | null) {
  if (!vehicle) return "No linked vehicle";

  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${
    vehicle.variant || ""
  }`
    .replace(/\s+/g, " ")
    .trim();
}

function calculateNetDealValue(deal: Deal) {
  const sale = Number(deal.sale_price) || 0;
  const extras = Number(deal.extras_amount) || 0;
  const discount = Number(deal.discount_amount) || 0;
  const tradeIn = Number(deal.trade_in_value) || 0;
  const settlement = Number(deal.settlement_amount) || 0;

  return sale + extras - discount - tradeIn + settlement;
}

function normalizePhoneForMatching(
  value: string | null | undefined
) {
  if (!value) return "";

  let cleaned = value.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = `27${cleaned.slice(1)}`;
  }

  if (
    cleaned.length === 9 &&
    !cleaned.startsWith("27")
  ) {
    cleaned = `27${cleaned}`;
  }

  return cleaned;
}

const COMMUNICATION_TEMPLATES = [
  { key: "follow_up", label: "Follow-up" },
  { key: "new_lead_response", label: "New enquiry response" },
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
  if (channel === "WhatsApp") return "💬";
  if (channel === "Email") return "✉️";
  if (channel === "Call") return "📞";
  return "📝";
}

function buildCommunicationTemplate(args: {
  templateKey: string;
  channel: "WhatsApp" | "Email" | "Call";
  customerName: string | null;
  vehicleName: string | null;
  salespersonName: string;
  financeStatus?: string | null;
  deliveryDate?: string | null;
}) {
  const customerFirstName =
    (args.customerName || "there").split(" ")[0] || "there";
  const vehicle = args.vehicleName || "the vehicle";

  let subject = `DealFlow update for ${args.customerName || "customer"}`;
  let body = "";

  if (args.templateKey === "new_lead_response") {
    subject = "Thanks for your enquiry";
    body = `Hi ${customerFirstName}, this is ${args.salespersonName} from the dealership. Thanks for your enquiry on ${vehicle}. I will assist you with the next steps.`;
  } else if (args.templateKey === "finance_documents_request") {
    subject = "Finance documents required";
    body = `Hi ${customerFirstName}, to continue with your finance application, please send your ID copy, proof of address, latest payslip and latest bank statements.`;
  } else if (args.templateKey === "finance_submitted_update") {
    subject = "Finance application submitted";
    body = `Hi ${customerFirstName}, your finance application for ${vehicle} has been submitted. I will update you as soon as we receive feedback.`;
  } else if (args.templateKey === "bank_approval_received") {
    subject = "Finance approval received";
    body = `Hi ${customerFirstName}, good news. We received finance feedback on your application for ${vehicle}. Please let me know when you are available to discuss the offer.`;
  } else if (args.templateKey === "vehicle_offer") {
    subject = `Vehicle offer: ${vehicle}`;
    body = `Hi ${customerFirstName}, I wanted to share the details for ${vehicle}. Please let me know if you would like to proceed or if you want to look at another option.`;
  } else if (args.templateKey === "delivery_confirmation") {
    subject = "Delivery confirmation";
    body = `Hi ${customerFirstName}, your delivery for ${vehicle}${args.deliveryDate ? ` is planned for ${args.deliveryDate}` : " is being arranged"}. Please confirm if this still suits you.`;
  } else if (args.templateKey === "follow_up") {
    subject = "Follow-up";
    body = `Hi ${customerFirstName}, I am following up on your enquiry for ${vehicle}. Please let me know if you need any further assistance.`;
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


export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();

  const customerLeadId = Number(params.id);

  const [customer, setCustomer] = useState<LeadCustomer | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [linkedVehicle, setLinkedVehicle] = useState<InventoryVehicle | null>(
    null
  );
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [financeApplication, setFinanceApplication] =
    useState<FinanceApplication | null>(null);
  const [dealChecklistItems, setDealChecklistItems] =
    useState<DealChecklistItem[]>([]);
  const [loadingDealChecklist, setLoadingDealChecklist] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [submittingToFinance, setSubmittingToFinance] = useState(false);
  const [showEditModal, setShowEditModal] =
  useState(false);

const [savingCustomer, setSavingCustomer] =
  useState(false);

const [editCustomerName, setEditCustomerName] =
  useState("");

const [editPhone, setEditPhone] =
  useState("");

const [editEmail, setEditEmail] =
  useState("");

const [editBudget, setEditBudget] =
  useState("");

const [editSource, setEditSource] =
  useState("");

const [editVehicle, setEditVehicle] =
  useState("");

const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
const [showCommunicationModal, setShowCommunicationModal] = useState(false);
const [communicationChannel, setCommunicationChannel] =
  useState<"WhatsApp" | "Email" | "Call">("WhatsApp");
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


  const totalDealValue = useMemo(() => {
    return deals.reduce((sum, deal) => sum + calculateNetDealValue(deal), 0);
  }, [deals]);

  const openTasks = tasks.filter((task) => task.status !== "Completed").length;


  function openEditCustomerModal() {
  if (!customer) return;

  setEditCustomerName(
    customer.customer || ""
  );

  setEditPhone(
    customer.phone || ""
  );

  setEditEmail(
    customer.email || ""
  );

  setEditBudget(
    customer.budget || ""
  );

  setEditSource(
    customer.source || ""
  );

  setEditVehicle(
    customer.vehicle || ""
  );

  setShowEditModal(true);
}

  async function saveCustomerChanges() {
  if (
    !customer ||
    !profile?.company_id ||
    !profile?.id
  ) {
    return;
  }

  const customerName =
    editCustomerName.trim();

  const phone =
    editPhone.trim();

  const email =
    editEmail.trim();

  const budget =
    editBudget.trim();

  const source =
    editSource.trim();

  const vehicle =
    editVehicle.trim();

  if (!customerName) {
    alert("Customer name is required.");
    return;
  }

  if (email && !email.includes("@")) {
    alert(
      "Please enter a valid email address."
    );
    return;
  }



  const newPhone =
    normalizePhoneForMatching(phone);

  const changes: string[] = [];

  if (customer.customer !== customerName) {
    changes.push(
      `Name changed from "${
        customer.customer || "-"
      }" to "${customerName}"`
    );
  }

  if ((customer.phone || "") !== phone) {
    changes.push(
      `Phone changed from "${
        customer.phone || "-"
      }" to "${phone || "-"}"`
    );
  }

  if ((customer.email || "") !== email) {
    changes.push(
      `Email changed from "${
        customer.email || "-"
      }" to "${email || "-"}"`
    );
  }

  if ((customer.budget || "") !== budget) {
    changes.push(
      `Budget changed from "${
        customer.budget || "-"
      }" to "${budget || "-"}"`
    );
  }

  if ((customer.source || "") !== source) {
    changes.push(
      `Source changed from "${
        customer.source || "-"
      }" to "${source || "-"}"`
    );
  }

  if ((customer.vehicle || "") !== vehicle) {
    changes.push(
      `Vehicle interest changed from "${
        customer.vehicle || "-"
      }" to "${vehicle || "-"}"`
    );
  }

  if (changes.length === 0) {
    alert("No customer changes were made.");
    return;
  }

  setSavingCustomer(true);

  try {
    const { error: leadError } =
      await supabase
        .from("leads")
        .update({
          customer: customerName,
          phone: phone || null,
          email: email || null,
          budget: budget || null,
          source: source || null,
          vehicle: vehicle || null,
        })
        .eq("id", customer.id)
        .eq(
          "company_id",
          profile.company_id
        );

    if (leadError) {
      alert(
        "Error updating customer: " +
          leadError.message
      );
      return;
    }

    /*
     * Keep the existing WhatsApp conversation matched
     * to the updated customer details.
     */
    const { error: conversationError } =
      await supabase
        .from("whatsapp_conversations")
        .update({
          customer_name: customerName,
          customer_phone:
            newPhone || null,
        })
        .eq(
          "company_id",
          profile.company_id
        )
        .eq("lead_id", customer.id);

    if (conversationError) {
      console.error(
        "Customer updated, but WhatsApp conversation could not be refreshed:",
        conversationError.message
      );
    }

    /*
     * Keep documents readable under the updated
     * customer name.
     */
    const { error: documentError } =
      await supabase
        .from("finance_documents")
        .update({
          customer_name: customerName,
        })
        .eq(
          "company_id",
          profile.company_id
        )
        .eq("lead_id", customer.id);

    if (documentError) {
      console.error(
        "Customer updated, but finance document names could not be refreshed:",
        documentError.message
      );
    }

    const { error: activityError } =
      await supabase
        .from("lead_activities")
        .insert({
          company_id:
            profile.company_id,

          lead_id:
            customer.id,

          title:
            "Customer Details Updated",

          description:
            changes.join(" • "),

          activity_type:
            "customer_update",

          color:
            "blue",
        });

    if (activityError) {
      console.error(
        "Customer updated, but the activity entry could not be saved:",
        activityError.message
      );
    }

    setCustomer((current) =>
      current
        ? {
            ...current,
            customer: customerName,
            phone: phone || null,
            email: email || null,
            budget: budget || null,
            source: source || null,
            vehicle: vehicle || null,
          }
        : current
    );

    setShowEditModal(false);

    await Promise.all([
      fetchCustomer(),
      fetchActivities(),
      fetchDocuments(),
    ]);

    alert(
      "Customer details updated successfully."
    );
  } catch (error) {
    console.error(
      "Unexpected customer update error:",
      error
    );

    alert(
      "Unexpected error updating customer."
    );
  } finally {
    setSavingCustomer(false);
  }
}

  async function fetchCustomer() {
    if (!profile?.company_id || !customerLeadId) return;

    setLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("id", customerLeadId)
      .eq("company_id", profile.company_id);

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error("Error loading customer profile:", error.message);
      setCustomer(null);
      setLoading(false);
      return;
    }

    setCustomer(data);
    setLoading(false);
  }

  async function fetchDeals() {
    if (!profile?.company_id || !customerLeadId) return;

    let query = supabase
      .from("deals")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .order("created_at", { ascending: false });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading customer deals:", error.message);
      setDeals([]);
      return;
    }

    setDeals(Array.isArray(data) ? data : []);
  }

  async function fetchLinkedVehicle() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("linked_lead_id", customerLeadId)
      .maybeSingle();

    if (error) {
      console.error("Error loading linked vehicle:", error.message);
      setLinkedVehicle(null);
      return;
    }

    setLinkedVehicle(data || null);
  }

  async function fetchDocuments() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("finance_documents")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading customer documents:", error.message);
      setDocuments([]);
      return;
    }

    setDocuments(Array.isArray(data) ? data : []);
  }

  async function fetchTasks() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error loading customer tasks:", error.message);
      setTasks([]);
      return;
    }

    setTasks(Array.isArray(data) ? data : []);
  }

  async function fetchActivities() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error loading customer activity:", error.message);
      setActivities([]);
      return;
    }

    setActivities(Array.isArray(data) ? data : []);
  }

  async function fetchLatestDealChecklist(
    dealId: number | null
  ) {
    if (!profile?.company_id || !dealId) {
      setDealChecklistItems([]);
      return;
    }

    setLoadingDealChecklist(true);

    const { data, error } = await supabase
      .from("deal_checklist_items")
      .select(
        "id, company_id, deal_id, title, category, is_completed, completed_at, display_order, created_at"
      )
      .eq("company_id", profile.company_id)
      .eq("deal_id", dealId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Error loading customer delivery checklist:",
        error.message
      );
      setDealChecklistItems([]);
    } else {
      setDealChecklistItems(
        Array.isArray(data) ? data : []
      );
    }

    setLoadingDealChecklist(false);
  }

  async function fetchFinanceApplication() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .maybeSingle();

    if (error) {
      console.error("Error loading finance application:", error.message);
      setFinanceApplication(null);
      return;
    }

    setFinanceApplication(data || null);
  }

  async function submitCustomerToFinance() {
    if (!customer || !profile?.company_id) return;

    if (financeApplication) {
      alert("This customer has already been submitted to Finance.");
      return;
    }

    const confirmed = window.confirm(
      `Submit ${customer.customer || "this customer"} to Finance?`
    );

    if (!confirmed) return;

    setSubmittingToFinance(true);

    const { data, error } = await supabase.rpc(
      "submit_lead_to_finance",
      { p_lead_id: customer.id }
    );

    setSubmittingToFinance(false);

    if (error) {
      alert("Could not submit to Finance: " + error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    await Promise.all([
      fetchCustomer(),
      fetchDeals(),
      fetchFinanceApplication(),
      fetchActivities(),
    ]);

    alert(
      result?.result_action === "already_exists"
        ? "This customer was already submitted to Finance."
        : "Customer submitted to Finance successfully."
    );
  }



  async function fetchCommunicationLogs() {
    if (!profile?.company_id || !customerLeadId) return;

    const { data, error } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("lead_id", customerLeadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading customer communication logs:", error.message);
      setCommunicationLogs([]);
      return;
    }

    setCommunicationLogs(Array.isArray(data) ? data : []);
  }

  function openCommunicationModal(
    channel: "WhatsApp" | "Email" | "Call",
    templateKey = "follow_up"
  ) {
    if (!customer) return;

    const template = buildCommunicationTemplate({
      templateKey,
      channel,
      customerName: customer.customer,
      vehicleName: linkedVehicle ? vehicleTitle(linkedVehicle) : customer.vehicle,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        customer.assigned_user_name ||
        "Sales",
      financeStatus: financeApplication?.finance_status,
      deliveryDate: latestDeal?.created_at,
    });

    setCommunicationChannel(channel);
    setCommunicationTemplateKey(templateKey);
    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
    setShowCommunicationModal(true);
  }

  function handleCommunicationTemplateChange(templateKey: string) {
    if (!customer) return;

    setCommunicationTemplateKey(templateKey);

    const template = buildCommunicationTemplate({
      templateKey,
      channel: communicationChannel,
      customerName: customer.customer,
      vehicleName: linkedVehicle ? vehicleTitle(linkedVehicle) : customer.vehicle,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        customer.assigned_user_name ||
        "Sales",
      financeStatus: financeApplication?.finance_status,
      deliveryDate: latestDeal?.created_at,
    });

    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
  }

  async function startCommunicationAction() {
    if (!customer || !profile?.company_id || !profile?.id) return;

    const customerPhone = normalizePhoneForMatching(customer.phone);
    const customerEmail = customer.email || "";

    if (communicationChannel === "WhatsApp" && !customerPhone) {
      alert("Customer phone number is missing.");
      return;
    }

    if (communicationChannel === "Email" && !customerEmail) {
      alert("Customer email address is missing.");
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
          lead_id: customer.id,
          deal_id: latestDeal?.id || null,
          finance_application_id: financeApplication?.id || null,
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
          customer_name: customer.customer,
          customer_phone: customer.phone,
          customer_email: customer.email,
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

      if (communicationChannel === "WhatsApp") {
        window.location.href = `whatsapp://send?phone=${customerPhone}&text=${encodeURIComponent(
          communicationMessage.trim()
        )}`;
      } else {
        window.location.href = `mailto:${encodeURIComponent(
          customerEmail
        )}?subject=${encodeURIComponent(
          communicationSubject.trim() || "DealFlow message"
        )}&body=${encodeURIComponent(communicationMessage.trim())}`;
      }

      await supabase.from("lead_activities").insert({
        company_id: profile.company_id,
        lead_id: customer.id,
        title: `${communicationChannel} Action Started`,
        description: [
          `Template: ${COMMUNICATION_TEMPLATES.find((item) => item.key === communicationTemplateKey)?.label || communicationTemplateKey}`,
          "Status: Pending Outcome",
          communicationChannel === "Email"
            ? `Subject: ${communicationSubject.trim() || "-"}`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        activity_type: "communication",
        color: "orange",
      });

      setShowCommunicationModal(false);
      setShowCommunicationOutcomeModal(true);
      await fetchCommunicationLogs();
      await fetchActivities();
    } finally {
      setSavingCommunication(false);
    }
  }

  async function resolveCommunicationOutcome() {
    if (!activeCommunicationLog || !customer || !profile?.company_id || !profile?.id) {
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
            p_lead_id: customer.id,
            p_assigned_user_id:
              customer.assigned_user_id || profile.id,
            p_title:
              `Follow up after ${activeCommunicationLog.channel}: ${customer.customer}`,
            p_description:
              communicationSummary.trim() ||
              `Follow up on ${activeCommunicationLog.channel} communication with ${customer.customer}.`,
            p_task_type: "Follow-up",
            p_priority: "Medium",
            p_due_date: new Date(communicationFollowUpDate).toISOString(),
            p_task_scope: "Sales",
            p_task_reason:
              activeCommunicationLog.channel === "WhatsApp"
                ? "WHATSAPP_FOLLOW_UP"
                : activeCommunicationLog.channel === "Email"
                ? "EMAIL_FOLLOW_UP"
                : "COMMUNICATION_FOLLOW_UP",
            p_related_record_type: "lead",
            p_related_record_id: customer.id,
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

      await supabase.from("lead_activities").insert({
        company_id: profile.company_id,
        lead_id: customer.id,
        title: `${activeCommunicationLog.channel} Outcome Logged`,
        description: [
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
        activity_type: "communication",
        color: finalStatus === "Not Sent" || finalStatus === "No Answer"
          ? "orange"
          : "green",
      });

      await Promise.all([
        fetchCommunicationLogs(),
        fetchCustomer(),
        fetchTasks(),
        fetchActivities(),
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

    if (activeCommunicationLog.channel === "WhatsApp") {
      const phone = normalizePhoneForMatching(activeCommunicationLog.customer_phone);

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
    setCommunicationChannel("WhatsApp");
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
    if (!customer || !profile?.company_id || !profile?.id) return;

    if (!communicationOutcome) {
      alert("Please select an outcome.");
      return;
    }

    setSavingCommunication(true);

    try {
      const { data, error } = await supabase.rpc(
        "resolve_manual_communication_outcome",
        {
          p_lead_id: customer.id,
          p_channel: communicationChannel,
          p_outcome: communicationOutcome,
          p_summary: communicationSummary.trim() || null,
          p_subject:
            communicationChannel === "Email"
              ? communicationSubject.trim() || null
              : null,
          p_message_body: communicationMessage.trim() || null,
          p_deal_id: latestDeal?.id || null,
          p_finance_application_id: financeApplication?.id || null,
        }
      );

      if (error) {
        alert("Could not save communication outcome: " + error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      await supabase.from("lead_activities").insert({
        company_id: profile.company_id,
        lead_id: customer.id,
        title: `${communicationChannel} Outcome Logged`,
        description: [
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
        activity_type: "communication",
        color: result?.resolved_existing ? "green" : "blue",
      });

      await Promise.all([
        fetchCommunicationLogs(),
        fetchCustomer(),
        fetchTasks(),
        fetchActivities(),
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

    useEffect(() => {
    fetchCustomer();
    fetchDeals();
    fetchLinkedVehicle();
    fetchDocuments();
    fetchTasks();
    fetchActivities();
    fetchFinanceApplication();
    fetchCommunicationLogs();
  }, [profile?.company_id, profile?.role, profile?.id, customerLeadId]);

  useEffect(() => {
    const latestDeal = deals[0] || null;
    void fetchLatestDealChecklist(latestDeal?.id || null);
  }, [deals, profile?.company_id]);

  const latestDeal = deals[0] || null;

  const completedChecklistItems =
    dealChecklistItems.filter(
      (item) => item.is_completed
    ).length;

  const outstandingChecklistItems =
    dealChecklistItems.filter(
      (item) => !item.is_completed
    );

  const checklistProgress =
    dealChecklistItems.length > 0
      ? Math.round(
          (completedChecklistItems /
            dealChecklistItems.length) *
            100
        )
      : 0;

  const deliveryReadiness =
    !latestDeal
      ? "No Deal"
      : dealChecklistItems.length === 0
      ? "Checklist Not Started"
      : checklistProgress === 100
      ? "Ready"
      : "In Progress";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
          Loading customer profile...
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Customer not found
          </h1>

          <p className="mt-2 text-slate-500">
            This customer could not be found or you do not have access to it.
          </p>

          <button
            onClick={() => router.push("/customers")}
            className="mt-5 rounded-xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Customers
          </button>
        </div>
      </DashboardLayout>
    );
  }

return (
  <DashboardLayout>
    <PageAccessGuard module="customers">
      <ReadOnlyNotice />
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link
                href="/customers"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                ← Back to Customers
              </Link>

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-emerald-500 text-2xl font-black text-white shadow-lg shadow-blue-900/15">
                  {getInitials(customer.customer)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="truncate text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                      {customer.customer || "Unnamed Customer"}
                    </h1>

                    <span
                      className={`${statusBadge(
                        customer.status
                      )} rounded-full px-3 py-1 text-xs font-black`}
                    >
                      {customer.status || "New Lead"}
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    Customer 360 profile generated from Lead #{customer.id}. Use this page to review contact details, communication, finance, deal progress, documents and delivery readiness.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {customer.phone || "No phone"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {customer.email || "No email"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Assigned: {customer.assigned_user_name || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:w-[420px]">
              <WriteAccessGuard>
                <button
                  type="button"
                  onClick={openEditCustomerModal}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100"
                >
                  Edit Customer
                </button>
              </WriteAccessGuard>

              <WriteAccessGuard>
                <button
                  type="button"
                  onClick={() => void submitCustomerToFinance()}
                  disabled={submittingToFinance || Boolean(financeApplication)}
                  className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-orange-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingToFinance
                    ? "Submitting..."
                    : financeApplication
                    ? "Finance Submitted"
                    : "Submit to Finance"}
                </button>
              </WriteAccessGuard>

              <Link
                href={`/leads/${customer.id}`}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Open Lead
              </Link>

              {deals[0] ? (
                <Link
                  href={`/deals/${deals[0].id}`}
                  className="rounded-2xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-green-500"
                >
                  Open Latest Deal
                </Link>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                  No Deal Yet
                </div>
              )}

              {linkedVehicle ? (
                <Link
                  href={`/inventory/${linkedVehicle.id}`}
                  className="sm:col-span-2 rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Open Linked Vehicle
                </Link>
              ) : (
                <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                  No linked vehicle yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          <MetricCard label="Deals" value={deals.length} />
          <MetricCard label="Deal Value" value={formatRand(totalDealValue)} />
          <MetricCard label="Documents" value={documents.length} />
          <MetricCard label="Open Tasks" value={openTasks} />
          <MetricCard
            label="Finance"
            value={
              financeApplication?.finance_status || customer.finance || "Not Started"
            }
          />
        </div>



        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Communication Assist
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use WhatsApp Assist or Email Assist, then log the customer outcome so tasks and notifications stay accurate.
              </p>
            </div>

            <WriteAccessGuard>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openCommunicationModal("WhatsApp", "follow_up")}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Send WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => openCommunicationModal("Email", "follow_up")}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Send Email
                </button>

                <button
                  type="button"
                  onClick={openManualOutcomeModal}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log Reply / Outcome
                </button>
              </div>
            </WriteAccessGuard>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">
                Last Contact
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Method" value={(customer as any).last_contact_method || "Not captured"} />
                <Info label="Outcome" value={(customer as any).last_contact_outcome || "Not captured"} />
                <Info label="By" value={(customer as any).last_contacted_by_name || "Not captured"} />
                <Info label="When" value={formatDateTime((customer as any).last_contacted_at)} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">
                  Recent Communication
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
                    No communication logged yet.
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              Customer Details
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Name" value={customer.customer} />
              <Info label="Phone" value={customer.phone} />
              <Info label="Email" value={customer.email} />
              <Info label="Budget" value={customer.budget} />
              <Info label="Source" value={customer.source} />
              <Info label="Assigned To" value={customer.assigned_user_name} />
              <Info label="Lead Status" value={customer.status || "New Lead"} />
              <Info label="Created" value={formatDate(customer.created_at)} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              Linked Vehicle
            </h2>

            {linkedVehicle ? (
              <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                  {linkedVehicle.image_url ? (
                    <img
                      src={linkedVehicle.image_url}
                      alt={vehicleTitle(linkedVehicle)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">🚗</span>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {vehicleTitle(linkedVehicle)}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Stock: {linkedVehicle.stock_code || "-"} • VIN:{" "}
                    {linkedVehicle.vin || "-"}
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Info label="Price" value={formatRand(linkedVehicle.price)} />
                    <Info
                      label="Mileage"
                      value={
                        linkedVehicle.mileage
                          ? `${linkedVehicle.mileage.toLocaleString("en-ZA")} km`
                          : "-"
                      }
                    />
                    <Info label="Status" value={linkedVehicle.status} />
                    <Info label="Location" value={linkedVehicle.location} />
                  </div>

                  <Link
                    href={`/inventory/${linkedVehicle.id}`}
                    className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    View Vehicle
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No inventory vehicle linked
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Link a vehicle from the lead detail page.
                </p>

                <Link
                  href={`/leads/${customer.id}`}
                  className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Open Lead
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Customer Deals
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Deals linked to this customer profile.
                </p>
              </div>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                {deals.length}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {deals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No deals yet
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Create a deal from a reserved vehicle or from the Deals page.
                  </p>
                </div>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Deal #{deal.id}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {deal.vehicle_name || "No vehicle captured"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Created {formatDate(deal.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`${dealStageBadge(
                            deal.deal_stage
                          )} rounded-full px-3 py-1 text-xs font-bold`}
                        >
                          {deal.deal_stage || "Draft"}
                        </span>

                        <span
                          className={`${financeBadge(
                            deal.finance_status
                          )} rounded-full px-3 py-1 text-xs font-bold`}
                        >
                          {deal.finance_status || "Not Started"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-extrabold text-slate-900">
                        {formatRand(calculateNetDealValue(deal))}
                      </p>

                      <Link
                        href={`/deals/${deal.id}`}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                      >
                        Open Deal
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Finance Snapshot
              </h2>

              {financeApplication ? (
                <div className="mt-5 space-y-3">
                  <Info
                    label="Status"
                    value={financeApplication.finance_status || "Submitted"}
                  />
                  <Info label="Bank" value={financeApplication.bank} />
                  <Info
                    label="Requested Amount"
                    value={formatRand(financeApplication.requested_amount)}
                  />
                  <Info
                    label="Deposit"
                    value={formatRand(financeApplication.deposit)}
                  />

                  <Link
                    href={`/finance/${financeApplication.id}`}
                    className="inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
                  >
                    Open Finance Application
                  </Link>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No finance application found
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Submit this customer from the lead detail page.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Delivery Checklist
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Delivery readiness for the latest customer Deal.
                  </p>
                </div>

                {latestDeal && (
                  <Link
                    href={`/deals/${latestDeal.id}`}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Open Deal
                  </Link>
                )}
              </div>

              {!latestDeal ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No Deal available
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a Deal before tracking delivery readiness.
                  </p>
                </div>
              ) : loadingDealChecklist ? (
                <p className="mt-5 text-sm text-slate-500">
                  Loading delivery checklist...
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Deal
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        #{latestDeal.id}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Completed
                      </p>
                      <p className="mt-1 font-bold text-green-700">
                        {completedChecklistItems} / {dealChecklistItems.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Readiness
                      </p>
                      <p className={`mt-1 font-bold ${
                        deliveryReadiness === "Ready"
                          ? "text-green-700"
                          : deliveryReadiness === "In Progress"
                          ? "text-orange-700"
                          : "text-slate-600"
                      }`}>
                        {deliveryReadiness}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">
                        Progress
                      </span>
                      <span className="font-bold text-slate-900">
                        {checklistProgress}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${checklistProgress}%` }}
                      />
                    </div>
                  </div>

                  {dealChecklistItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Checklist not started
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Open the Deal to initialise the delivery checklist.
                      </p>
                    </div>
                  ) : outstandingChecklistItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold text-green-800">
                        All delivery checklist items are complete.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Outstanding items
                      </p>
                      <div className="mt-2 space-y-2">
                        {outstandingChecklistItems
                          .slice(0, 4)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-xl bg-orange-50 px-3 py-2"
                            >
                              <span className="text-sm font-medium text-orange-900">
                                {item.title}
                              </span>
                              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-orange-700">
                                {item.category || "Delivery"}
                              </span>
                            </div>
                          ))}
                      </div>

                      {outstandingChecklistItems.length > 4 && (
                        <p className="mt-2 text-xs text-slate-500">
                          +{outstandingChecklistItems.length - 4} more outstanding item(s)
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Follow-Up Tasks
              </h2>

              <div className="mt-5 space-y-3">
                {tasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No tasks found
                    </p>
                  </div>
                ) : (
                  tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {task.title}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {task.description || "No description"}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            Due {formatDateTime(task.due_date)}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {task.status || "Open"}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                <Link
                  href={`/leads/${customer.id}`}
                  className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Manage Tasks on Lead
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Documents
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Documents linked to this customer / lead.
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                {documents.length}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No documents found
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Upload documents from the lead or deal page.
                  </p>
                </div>
              ) : (
                documents.slice(0, 6).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          {doc.document_type || "Document"}
                        </p>

                        <p className="mt-1 truncate text-sm text-slate-500">
                          {doc.document_name || `Document #${doc.id}`}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Uploaded {formatDate(doc.created_at)}
                        </p>
                      </div>

                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}

              <Link
                href="/documents"
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open All Documents
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Activity History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recent customer activity from the lead timeline.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {activities.length}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No activity found
                  </p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />

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
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

{showEditModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Edit Customer Details
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Update the customer and current sales opportunity
            information.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowEditModal(false)
          }
          disabled={savingCustomer}
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-700">
            Customer Name
          </label>

          <input
            type="text"
            value={editCustomerName}
            onChange={(event) =>
              setEditCustomerName(
                event.target.value
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Phone
          </label>

          <input
            type="tel"
            value={editPhone}
            onChange={(event) =>
              setEditPhone(
                event.target.value
              )
            }
            placeholder="0821234567"
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />

          <p className="mt-1 text-xs text-slate-500">
            Changing this also updates the linked WhatsApp
            conversation.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Email
          </label>

          <input
            type="email"
            value={editEmail}
            onChange={(event) =>
              setEditEmail(
                event.target.value
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Budget
          </label>

          <input
            type="text"
            value={editBudget}
            onChange={(event) =>
              setEditBudget(
                event.target.value
              )
            }
            placeholder="Example: R8,500 per month"
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Lead Source
          </label>

          <select
            value={editSource}
            onChange={(event) =>
              setEditSource(
                event.target.value
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            <option value="">
              Select source...
            </option>
            <option value="Walk-in">
              Walk-in
            </option>
            <option value="Website">
              Website
            </option>
            <option value="Facebook">
              Facebook
            </option>
            <option value="WhatsApp">
              WhatsApp
            </option>
            <option value="Referral">
              Referral
            </option>
            <option value="Phone">
              Phone
            </option>
            <option value="Other">
              Other
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Vehicle Interest
          </label>

          <input
            type="text"
            value={editVehicle}
            onChange={(event) =>
              setEditVehicle(
                event.target.value
              )
            }
            placeholder="Example: 2024 Toyota Corolla"
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            setShowEditModal(false)
          }
          disabled={savingCustomer}
          className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={saveCustomerChanges}
          disabled={savingCustomer}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {savingCustomer
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
)}



{showCommunicationModal && customer && (
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
              const channel = event.target.value as "WhatsApp" | "Email" | "Call";
              setCommunicationChannel(channel);
              const template = buildCommunicationTemplate({
                templateKey: communicationTemplateKey,
                channel,
                customerName: customer.customer,
                vehicleName: linkedVehicle ? vehicleTitle(linkedVehicle) : customer.vehicle,
                salespersonName: profile?.full_name || profile?.email || customer.assigned_user_name || "Sales",
                financeStatus: financeApplication?.finance_status,
                deliveryDate: latestDeal?.created_at,
              });
              setCommunicationSubject(template.subject);
              setCommunicationMessage(template.body);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            <option value="WhatsApp">WhatsApp</option>
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

{showCommunicationOutcomeModal && customer && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-slate-900">
        Resolve Communication Outcome
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        This keeps Customer 360 accurate even though the message was sent outside DealFlow.
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
            onChange={(event) => setCommunicationChannel(event.target.value as "WhatsApp" | "Email" | "Call")}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
            <option value="Call">Call</option>
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
          placeholder="Example: Customer asked for finance documents tomorrow morning."
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <h2 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950">
        {value}
      </h2>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}