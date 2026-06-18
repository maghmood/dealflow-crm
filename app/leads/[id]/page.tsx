"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

type SalesUser = {
  id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
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

type Lead = {
  id: number;
  customer: string;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  status: string | null;
  salesperson: string | null;
  finance: string | null;
  budget: string | null;
  source: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  last_contacted_at?: string | null;
  last_contacted_by_id?: number | null;
  last_contacted_by_name?: string | null;
  last_contact_method?: string | null;
  last_contact_outcome?: string | null;
};

type Activity = {
  id: number;
  lead_id: number;
  title: string;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string;
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

type WhatsAppDbMessage = {
  id: number;
  sender_type: "customer" | "user";
  sender_name: string | null;
  message: string;
  created_at: string;
};

type FinanceDocument = {
  id: number;
  lead_id: number | null;
  company_id: number | null;
  customer_name: string | null;
  uploaded_by: string | null;
  document_type: string | null;
  file_url: string | null;
  created_at: string;
};

type InventoryVehicle = {
  id: number;
  company_id: number | null;
  stock_code: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  cost_price: number | null;
  colour: string | null;
  vin: string | null;
  registration_number: string | null;
  image_url: string | null;
  status: string | null;
  location: string | null;
  notes: string | null;
  linked_lead_id: number | null;
  linked_customer_name: string | null;
  created_at: string | null;
};

type VehicleMatch = {
  vehicle: InventoryVehicle;
  category: "Best Match" | "Value Option" | "Slightly Above Budget";
  estimatedInstallment: number;
  priceDifference: number;
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

type FinanceBankOffer = {
  id: number;
  finance_application_id: number;
  bank_name: string;
  status: "Submitted" | "Pending" | "Approved" | "Declined";
  approved_amount: number | null;
  interest_rate: number | null;
  deposit_amount: number | null;
  term_months: number | null;
  balloon_percentage: number | null;
  monthly_installment: number | null;
  approval_expiry_date: string | null;
  conditions: string | null;
  notes: string | null;
  response_date: string;
  is_selected: boolean;
  selected_at: string | null;
  selected_by_name: string | null;
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

type LeadDealSnapshot = {
  id: number;
  lead_id: number | null;
  vehicle_id: number | null;
  customer_name: string | null;
  vehicle_name: string | null;
  sale_price: number | null;
  deposit_amount: number | null;
  trade_in_value: number | null;
  settlement_amount: number | null;
  extras_amount: number | null;
  discount_amount: number | null;
  deal_stage: string | null;
  finance_status: string | null;
  prep_started_at: string | null;
  planned_delivery_at: string | null;
  ready_for_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
};

function formatRand(value: number | null | undefined) {
  if (!value && value !== 0) return "Not captured";

  return `R${Number(value).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  })}`;
}

function formatVehicleTitle(vehicle: InventoryVehicle | null) {
  if (!vehicle) return "Vehicle not selected";

  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${
    vehicle.variant || ""
  }`
    .replace(/\s+/g, " ")
    .trim();
}

function vehicleStatusBadge(status: string | null) {
  const value = status || "Available";

  const styles: Record<string, string> = {
    Available: "bg-green-100 text-green-700",
    Reserved: "bg-orange-100 text-orange-700",
    Sold: "bg-slate-200 text-slate-700",
    "Sale Pending": "bg-emerald-100 text-emerald-700",
    "In Prep": "bg-blue-100 text-blue-700",
    "Ready for Delivery": "bg-purple-100 text-purple-700",
    Delivered: "bg-purple-100 text-purple-700",
    "On Hold": "bg-red-100 text-red-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function calculateMonthlyInstallment(
  vehiclePrice: number,
  depositAmount: number,
  annualInterestRate: number,
  termMonths: number,
  balloonPercentage: number
) {
  const price = Math.max(vehiclePrice, 0);
  const deposit = Math.max(depositAmount, 0);
  const months = Math.max(termMonths, 1);
  const balloonRate = Math.max(balloonPercentage, 0) / 100;

  const financedAmount = Math.max(price - deposit, 0);
  const balloonAmount = price * balloonRate;
  const monthlyRate = Math.max(annualInterestRate, 0) / 100 / 12;

  if (monthlyRate === 0) {
    return Math.max((financedAmount - balloonAmount) / months, 0);
  }

  const discountedBalloon =
    balloonAmount / Math.pow(1 + monthlyRate, months);

  const paymentPresentValue = financedAmount - discountedBalloon;

  if (paymentPresentValue <= 0) return 0;

  return (
    (paymentPresentValue * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -months))
  );
}

function calculateMaximumVehiclePrice(
  targetMonthlyInstallment: number,
  depositAmount: number,
  annualInterestRate: number,
  termMonths: number,
  balloonPercentage: number
) {
  const monthlyPayment = Math.max(targetMonthlyInstallment, 0);
  const deposit = Math.max(depositAmount, 0);
  const months = Math.max(termMonths, 1);
  const balloonRate = Math.max(balloonPercentage, 0) / 100;
  const monthlyRate = Math.max(annualInterestRate, 0) / 100 / 12;

  if (monthlyRate === 0) {
    const denominator = 1 - balloonRate;

    if (denominator <= 0) return 0;

    return (deposit + monthlyPayment * months) / denominator;
  }

  const annuityPresentValue =
    monthlyPayment *
    ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);

  const discountedBalloonRate =
    balloonRate / Math.pow(1 + monthlyRate, months);

  const denominator = 1 - discountedBalloonRate;

  if (denominator <= 0) return 0;

  return (deposit + annuityPresentValue) / denominator;
}

function calculateDealFinanceAmount(
  deal: LeadDealSnapshot
) {
  const salePrice =
    Number(deal.sale_price) || 0;

  const extras =
    Number(deal.extras_amount) || 0;

  const discount =
    Number(deal.discount_amount) || 0;

  const tradeIn =
    Number(deal.trade_in_value) || 0;

  const settlement =
    Number(deal.settlement_amount) || 0;

  const deposit =
    Number(deal.deposit_amount) || 0;

  const netDealValue =
    salePrice +
    extras -
    discount -
    tradeIn +
    settlement;

  return Math.max(
    netDealValue - deposit,
    0
  );
}


const COMMUNICATION_TEMPLATES = [
  {
    key: "new_lead_response",
    label: "New lead response",
    channel: "Both",
  },
  {
    key: "follow_up",
    label: "General follow-up",
    channel: "Both",
  },
  {
    key: "finance_documents_request",
    label: "Finance documents request",
    channel: "Both",
  },
  {
    key: "finance_submitted_update",
    label: "Finance submitted update",
    channel: "Both",
  },
  {
    key: "bank_approval_received",
    label: "Bank approval received",
    channel: "Both",
  },
  {
    key: "vehicle_offer",
    label: "Vehicle offer",
    channel: "Both",
  },
  {
    key: "delivery_confirmation",
    label: "Delivery date confirmation",
    channel: "Both",
  },
  {
    key: "custom",
    label: "Custom message",
    channel: "Both",
  },
];

const COMMUNICATION_OUTCOMES = [
  "Sent",
  "Customer Replied",
  "No Response",
  "No Answer",
  "Callback Requested",
  "Documents Requested",
  "Documents Sent",
  "Interested",
  "Not Interested",
  "Vehicle Discussed",
  "Finance Discussed",
  "Delivery Confirmed",
  "Closed",
  "Other",
];

function communicationStatusBadge(status: string | null) {
  const value = status || "Pending Outcome";

  const styles: Record<string, string> = {
    "Pending Outcome": "bg-orange-100 text-orange-700",
    "Sent Manually": "bg-green-100 text-green-700",
    "Not Sent": "bg-slate-200 text-slate-700",
    "Customer Replied": "bg-blue-100 text-blue-700",
    "No Answer": "bg-red-100 text-red-700",
    "Follow-up Created": "bg-purple-100 text-purple-700",
    Closed: "bg-slate-100 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function buildCommunicationTemplate(args: {
  templateKey: string;
  channel: "WhatsApp" | "Email";
  lead: Lead;
  vehicleTitle: string;
  deal: LeadDealSnapshot | null;
  financeOffer: FinanceBankOffer | null;
  salespersonName: string;
}) {
  const {
    templateKey,
    channel,
    lead,
    vehicleTitle,
    deal,
    financeOffer,
    salespersonName,
  } = args;

  const customerFirstName =
    (lead.customer || "there").split(" ")[0] || "there";

  const vehicle =
    vehicleTitle && vehicleTitle !== "Vehicle not selected"
      ? vehicleTitle
      : lead.vehicle || "the vehicle";

  const monthly =
    financeOffer?.monthly_installment !== null &&
    financeOffer?.monthly_installment !== undefined
      ? formatRand(financeOffer.monthly_installment)
      : null;

  const bank =
    financeOffer?.bank_name || "the bank";

  const deliveryDate =
    deal?.planned_delivery_at
      ? new Date(deal.planned_delivery_at).toLocaleString("en-ZA")
      : null;

  let subject = `DealFlow update for ${lead.customer}`;
  let body = "";

  if (templateKey === "new_lead_response") {
    subject = `Thanks for your enquiry`;
    body = `Hi ${customerFirstName}, this is ${salespersonName} from the dealership. Thanks for your enquiry on ${vehicle}. I will assist you with the next steps.`;
  } else if (templateKey === "finance_documents_request") {
    subject = `Finance documents required`;
    body = `Hi ${customerFirstName}, to continue with your finance application, please send your ID copy, proof of address, latest payslip and latest bank statements.`;
  } else if (templateKey === "finance_submitted_update") {
    subject = `Finance application submitted`;
    body = `Hi ${customerFirstName}, your finance application for ${vehicle} has been submitted. I will update you as soon as we receive feedback.`;
  } else if (templateKey === "bank_approval_received") {
    subject = `Finance approval received`;
    body = `Hi ${customerFirstName}, good news. We received a finance approval from ${bank}${monthly ? ` with an estimated installment of ${monthly}` : ""}. Please let me know when you are available to discuss the offer.`;
  } else if (templateKey === "vehicle_offer") {
    subject = `Vehicle offer: ${vehicle}`;
    body = `Hi ${customerFirstName}, I wanted to share the details for ${vehicle}. Please let me know if you would like to proceed or if you want to look at another option.`;
  } else if (templateKey === "delivery_confirmation") {
    subject = `Delivery confirmation`;
    body = `Hi ${customerFirstName}, your delivery for ${vehicle}${deliveryDate ? ` is planned for ${deliveryDate}` : " is being arranged"}. Please confirm if this still suits you.`;
  } else if (templateKey === "follow_up") {
    subject = `Follow-up`;
    body = `Hi ${customerFirstName}, I am following up on your enquiry for ${vehicle}. Please let me know if you need any further assistance.`;
  } else {
    subject = `Message from the dealership`;
    body = `Hi ${customerFirstName}, `;
  }

  if (channel === "Email") {
    body = `${body}\n\nRegards,\n${salespersonName}`;
  }

  return { subject, body };
}

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = Number(params.id);
  const { profile } = useAuth();
const canChooseTaskAssignee =
  profile?.role === "Admin" ||
  profile?.role === "Manager";
  const whatsappSectionRef = useRef<HTMLDivElement | null>(null);
  const whatsappInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [leadTasks, setLeadTasks] = useState<LeadTask[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<number | "">("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [financeApplicationId, setFinanceApplicationId] = useState<
    number | null
  >(null);
  const [financeBankOffers, setFinanceBankOffers] = useState<FinanceBankOffer[]>([]);
  const [loadingFinanceBankOffers, setLoadingFinanceBankOffers] = useState(false);
  const [selectingFinanceOfferId, setSelectingFinanceOfferId] = useState<number | null>(null);

  const [linkedDealSnapshot, setLinkedDealSnapshot] =
    useState<LeadDealSnapshot | null>(null);
  const [loadingLinkedDeal, setLoadingLinkedDeal] = useState(false);
  const [dealChecklistItems, setDealChecklistItems] = useState<
    DealChecklistItem[]
  >([]);
  const [loadingDealChecklist, setLoadingDealChecklist] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealSalePrice, setDealSalePrice] = useState("");
  const [dealDeposit, setDealDeposit] = useState("");
  const [dealTradeIn, setDealTradeIn] = useState("");
  const [dealSettlement, setDealSettlement] = useState("");
  const [dealExtras, setDealExtras] = useState("");
  const [dealDiscount, setDealDiscount] = useState("");
  const [dealNotes, setDealNotes] = useState("");

  const [loading, setLoading] = useState(true);

  const [linkedVehicle, setLinkedVehicle] = useState<InventoryVehicle | null>(
    null
  );
  const [inventoryVehicles, setInventoryVehicles] = useState<InventoryVehicle[]>(
    []
  );
  const [selectedInventoryVehicleId, setSelectedInventoryVehicleId] = useState<
    number | ""
  >("");
  const [showVehicleLinkModal, setShowVehicleLinkModal] = useState(false);
  const [linkingVehicle, setLinkingVehicle] = useState(false);

  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppDbMessage[]>(
    []
  );
  const [whatsappInput, setWhatsappInput] = useState("");
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

const [showCallModal, setShowCallModal] = useState(false);
const [callOutcome, setCallOutcome] = useState("");
const [callNotes, setCallNotes] = useState("");
const [callFollowUpDate, setCallFollowUpDate] = useState("");
const [savingCall, setSavingCall] = useState(false);

const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
const [showCommunicationModal, setShowCommunicationModal] = useState(false);
const [communicationChannel, setCommunicationChannel] =
  useState<"WhatsApp" | "Email">("WhatsApp");
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
  useState(false);
const [communicationFollowUpDate, setCommunicationFollowUpDate] = useState("");
const [callCommunicationLogId, setCallCommunicationLogId] =
  useState<number | null>(null);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskAssignedUserId, setTaskAssignedUserId] = useState<number | "">("");

  const [leadStatus, setLeadStatus] = useState("New Lead");
  const [timeline, setTimeline] = useState<Activity[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loadingCallLogs, setLoadingCallLogs] = useState(false);
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  const [documentType, setDocumentType] = useState("ID Copy");
  const [uploadingDocument, setUploadingDocument] = useState(false);

const [vehiclePrice, setVehiclePrice] = useState("429900");
const [targetMonthlyInstallment, setTargetMonthlyInstallment] =
  useState("8500");
const [deposit, setDeposit] = useState("40000");
const [interestRate, setInterestRate] = useState("13.5");
const [termMonths, setTermMonths] = useState("72");
const [balloonPercentage, setBalloonPercentage] = useState("0");
const [affordabilityAssessments, setAffordabilityAssessments] = useState<
  AffordabilityAssessment[]
>([]);

const [assessmentNotes, setAssessmentNotes] = useState("");
const [savingAssessment, setSavingAssessment] = useState(false);
const [loadingAssessments, setLoadingAssessments] = useState(false);
const priceNumber = Number(vehiclePrice) || 0;
const targetInstallmentNumber =
  Number(targetMonthlyInstallment) || 0;
const depositNumber = Number(deposit) || 0;
const rateNumber = Number(interestRate) || 0;
const termNumber = Number(termMonths) || 1;
const balloonNumber = Number(balloonPercentage) || 0;

const financeAmount = Math.max(priceNumber - depositNumber, 0);

const balloonAmount = Math.max(
  priceNumber * (balloonNumber / 100),
  0
);

const estimatedInstallment = calculateMonthlyInstallment(
  priceNumber,
  depositNumber,
  rateNumber,
  termNumber,
  balloonNumber
);

const maximumAffordableVehiclePrice = calculateMaximumVehiclePrice(
  targetInstallmentNumber,
  depositNumber,
  rateNumber,
  termNumber,
  balloonNumber
);

const affordabilityDifference =
  maximumAffordableVehiclePrice - priceNumber;

const linkedVehicleIsAffordable =
  priceNumber > 0 &&
  priceNumber <= maximumAffordableVehiclePrice;

const vehicleMatches = useMemo<VehicleMatch[]>(() => {
  if (maximumAffordableVehiclePrice <= 0) return [];

  return inventoryVehicles
    .filter((vehicle) => {
      const price = Number(vehicle.price) || 0;

      return (
        price > 0 &&
        vehicle.status === "Available" &&
        price <= maximumAffordableVehiclePrice * 1.1
      );
    })
    .map((vehicle) => {
      const price = Number(vehicle.price) || 0;
      const ratio = price / maximumAffordableVehiclePrice;

      let category: VehicleMatch["category"];

      if (price > maximumAffordableVehiclePrice) {
        category = "Slightly Above Budget";
      } else if (ratio >= 0.85) {
        category = "Best Match";
      } else {
        category = "Value Option";
      }

      return {
        vehicle,
        category,
        estimatedInstallment: calculateMonthlyInstallment(
          price,
          depositNumber,
          rateNumber,
          termNumber,
          balloonNumber
        ),
        priceDifference: maximumAffordableVehiclePrice - price,
      };
    })
    .sort((a, b) => {
      const categoryOrder = {
        "Best Match": 1,
        "Value Option": 2,
        "Slightly Above Budget": 3,
      };

      const categoryDifference =
        categoryOrder[a.category] - categoryOrder[b.category];

      if (categoryDifference !== 0) return categoryDifference;

      return (
        Math.abs(a.priceDifference) -
        Math.abs(b.priceDifference)
      );
    });
}, [
  inventoryVehicles,
  maximumAffordableVehiclePrice,
  depositNumber,
  rateNumber,
  termNumber,
  balloonNumber,
]);

const bestMatches = vehicleMatches.filter(
  (match) => match.category === "Best Match"
);

const valueOptions = vehicleMatches.filter(
  (match) => match.category === "Value Option"
);

const slightlyAboveBudget = vehicleMatches.filter(
  (match) => match.category === "Slightly Above Budget"
);

  function normalizePhone(phone: string | null) {
    if (!phone) return "";

    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.startsWith("0")) {
      cleaned = "27" + cleaned.slice(1);
    }

    return cleaned;
  }

  function shouldOpenPhoneDialler() {
    if (typeof navigator === "undefined") return false;

    const userAgent = navigator.userAgent || "";
    const isMobileDevice =
      /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent);

    const hasCoarsePointer =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    return isMobileDevice || hasCoarsePointer;
  }

async function startCustomerCall() {
  if (!lead || !profile?.company_id || !profile?.id) {
    alert("Lead or user details are missing.");
    return;
  }

  if (!lead.phone) {
    alert("Customer phone number is missing.");
    return;
  }

  const normalizedPhone = normalizePhone(lead.phone);

  if (!normalizedPhone) {
    alert("Customer phone number is invalid.");
    return;
  }

  setCallOutcome("");
  setCallNotes("");
  setCallFollowUpDate("");

  const { data, error } = await supabase
    .from("communication_logs")
    .insert({
      company_id: profile.company_id,
      lead_id: lead.id,
      deal_id: linkedDealSnapshot?.id || null,
      finance_application_id: financeApplicationId,
      channel: "Call",
      direction: "Outbound",
      template_key: "call_attempt",
      subject: "Call attempt",
      message_body: `Outbound call to ${lead.customer}`,
      outcome: null,
      summary: null,
      send_status: "Pending Outcome",
      customer_name: lead.customer,
      customer_phone: lead.phone,
      customer_email: lead.email,
      created_by_id: profile.id,
      created_by_name:
        profile.full_name || profile.email || "Unknown User",
    })
    .select("*")
    .single();

  if (error || !data) {
    alert(
      "Could not start the tracked call action: " +
        (error?.message || "Unknown error")
    );
    return;
  }

  setCallCommunicationLogId(data.id);
  setShowCallModal(true);

  if (shouldOpenPhoneDialler()) {
    setTimeout(() => {
      window.location.href = `tel:+${normalizedPhone}`;
    }, 100);
  } else {
    try {
      await navigator.clipboard.writeText(`+${normalizedPhone}`);

      alert(
        `Tracked call action created. The customer number +${normalizedPhone} has been copied. Use your phone or desktop softphone to call, then save the call outcome in DealFlow.`
      );
    } catch {
      alert(
        `Tracked call action created. Please call +${normalizedPhone} using your phone or desktop softphone, then save the call outcome in DealFlow.`
      );
    }
  }

  await fetchCommunicationLogs();
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
async function openSecureDocument(
  documentId: number,
  mode: "view" | "download"
) {
  /*
   * Open the tab immediately while still inside the
   * user's button click.
   */
  const documentWindow = window.open(
    "about:blank",
    "_blank"
  );

  if (!documentWindow) {
    alert(
      "The document window was blocked. Please allow pop-ups for DealFlow."
    );
    return;
  }

  /*
   * Prevent the new tab from controlling the DealFlow tab.
   */
  documentWindow.opener = null;

  documentWindow.document.title =
    "Preparing document";

  documentWindow.document.body.innerHTML = `
    <div style="
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #334155;
    ">
      <h2>Preparing secure document...</h2>
      <p>Please wait while DealFlow opens the file.</p>
    </div>
  `;

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token
    ) {
      documentWindow.close();

      alert(
        "Your login session has expired. Please sign in again."
      );
      return;
    }

    const response = await fetch(
      `/api/documents/${documentId}/signed-url?mode=${mode}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (
      !response.ok ||
      !result.signedUrl
    ) {
      documentWindow.close();

      alert(
        result.error ||
          "The document could not be opened."
      );
      return;
    }

    documentWindow.location.href =
      result.signedUrl;
  } catch (error) {
    documentWindow.close();

    console.error(
      "Unexpected secure document error:",
      error
    );

    alert(
      "Unexpected error opening the document."
    );
  }
}
  async function fetchLeadTasks() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile.company_id)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error loading lead tasks:", error.message);
      setLeadTasks([]);
      return;
    }

    setLeadTasks(data || []);
  }

  async function fetchLinkedInventoryVehicle() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("linked_lead_id", leadId)
      .maybeSingle();

    if (error) {
      console.error("Error loading linked inventory vehicle:", error.message);
      setLinkedVehicle(null);
      return;
    }

    setLinkedVehicle(data || null);

    if (data?.price) {
      setVehiclePrice(String(data.price));
    }
  }

  async function fetchInventoryVehicles() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("*")
      .eq("company_id", profile.company_id)
      .in("status", ["Available", "Reserved", "In Prep", "On Hold"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading inventory vehicles:", error.message);
      setInventoryVehicles([]);
      return;
    }

    setInventoryVehicles(Array.isArray(data) ? data : []);
  }

  async function linkInventoryVehicleById(vehicleId: number) {
  if (!profile?.company_id || !lead) {
    alert("Lead or company information is missing.");
    return;
  }

  const selectedVehicle = inventoryVehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );

  if (!selectedVehicle) {
    alert("Selected vehicle could not be found.");
    return;
  }

  const confirmed = window.confirm(
    `Link ${formatVehicleTitle(selectedVehicle)} to ${lead.customer}?`
  );

  if (!confirmed) return;

  setLinkingVehicle(true);

  try {
    const title = formatVehicleTitle(selectedVehicle);

    const { data, error } = await supabase.rpc(
      "link_inventory_vehicle_to_lead",
      {
        p_lead_id: lead.id,
        p_vehicle_id: selectedVehicle.id,
      }
    );

    if (error) {
      alert("Error linking vehicle: " + error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    await addActivity(
      "Vehicle Linked from Affordability Match",
      [
        title,
        selectedVehicle.stock_code
          ? `Stock ${selectedVehicle.stock_code}`
          : null,
        `Price ${formatRand(selectedVehicle.price)}`,
        `Estimated instalment ${formatRand(
          calculateMonthlyInstallment(
            Number(selectedVehicle.price) || 0,
            depositNumber,
            rateNumber,
            termNumber,
            balloonNumber
          )
        )}/month`,
      ]
        .filter(Boolean)
        .join(" • "),
      "inventory",
      "green"
    );

    setLead({
      ...lead,
      vehicle: result?.vehicle_title || title,
    });

    setLinkedVehicle({
      ...selectedVehicle,
      status: result?.vehicle_status || "Reserved",
      linked_lead_id: lead.id,
      linked_customer_name: lead.customer,
    });

    setVehiclePrice(
      selectedVehicle.price
        ? String(selectedVehicle.price)
        : vehiclePrice
    );

    setShowVehicleLinkModal(false);
    setSelectedInventoryVehicleId("");

    await Promise.all([
      fetchLead(),
      fetchLinkedInventoryVehicle(),
      fetchInventoryVehicles(),
      fetchActivities(),
    ]);

    alert("Vehicle linked successfully.");
  } finally {
    setLinkingVehicle(false);
  }
}

async function linkInventoryVehicleToLead() {
  if (selectedInventoryVehicleId === "") {
    alert("Please select a vehicle to link.");
    return;
  }

  await linkInventoryVehicleById(
    Number(selectedInventoryVehicleId)
  );
}

  async function fetchWhatsappMessages() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading WhatsApp messages:", error.message);
      setWhatsappMessages([]);
      return;
    }

    setWhatsappMessages(Array.isArray(data) ? data : []);
  }

  async function sendWhatsappMessage() {
  if (!lead || !profile?.company_id) return;

  const to = normalizePhone(lead.phone);

  if (!to) {
    alert("Customer phone number is missing.");
    return;
  }

  if (!whatsappInput.trim()) {
    alert("Please type a WhatsApp message.");
    return;
  }

  setSendingWhatsapp(true);

  const messageToSend = whatsappInput.trim();

  try {
   const {
  data: sessionData,
  error: sessionError,
} = await supabase.auth.getSession();

if (sessionError || !sessionData.session?.access_token) {
  alert("Your login session has expired. Please sign in again.");
  return;
}

const response = await fetch("/api/whatsapp/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionData.session.access_token}`,
  },
  body: JSON.stringify({
    leadId: lead.id,
    message: messageToSend,
    mode: "text",
  }),
});

    const result = await response.json();
    const verifiedRecipient =
  result?.recipient || normalizePhone(lead.phone);

    if (!response.ok) {
      alert(JSON.stringify(result, null, 2));
      return;
    }

    const metaMessageId =
      result?.data?.messages?.[0]?.id || null;

    const messageDate = new Date().toISOString();

    const { data: existingConversation, error: conversationCheckError } =
      await supabase
        .from("whatsapp_conversations")
        .select("id, first_response_at, last_inbound_at")
        .eq("company_id", profile.company_id)
        .eq("lead_id", lead.id)
        .maybeSingle();

    if (conversationCheckError) {
      alert(
        "Message sent, but conversation lookup failed: " +
          conversationCheckError.message
      );
      return;
    }

    let conversationId: number;

    if (existingConversation) {
      conversationId = existingConversation.id;

      const firstResponseAt =
        !existingConversation.first_response_at &&
        existingConversation.last_inbound_at
          ? messageDate
          : existingConversation.first_response_at;

      const { error: conversationUpdateError } = await supabase
        .from("whatsapp_conversations")
        .update({
          customer_name: lead.customer,
          customer_phone: verifiedRecipient,
          assigned_user_id: lead.assigned_user_id,
          assigned_user_name: lead.assigned_user_name,
          last_message: messageToSend,
          last_message_at: messageDate,
          last_outbound_at: messageDate,
          unread_count: 0,
          waiting_for_response: false,
          first_response_at: firstResponseAt,
          last_read_at: messageDate,
          status: "Open",
          closed_at: null,
          is_unmatched: false,
        })
        .eq("id", conversationId)
        .eq("company_id", profile.company_id);

      if (conversationUpdateError) {
        alert(
          "Message sent, but conversation update failed: " +
            conversationUpdateError.message
        );
        return;
      }
    } else {
      const { data: createdConversation, error: conversationCreateError } =
        await supabase
          .from("whatsapp_conversations")
          .insert({
            company_id: profile.company_id,
            lead_id: lead.id,
            customer_name: lead.customer,
            customer_phone: verifiedRecipient,
            assigned_user_id: lead.assigned_user_id,
            assigned_user_name: lead.assigned_user_name,
            last_message: messageToSend,
            last_message_at: messageDate,
            last_outbound_at: messageDate,
            unread_count: 0,
            waiting_for_response: false,
            status: "Open",
            is_unmatched: false,
          })
          .select("id")
          .single();

      if (conversationCreateError || !createdConversation) {
        alert(
          "Message sent, but conversation creation failed: " +
            (conversationCreateError?.message || "Unknown error")
        );
        return;
      }

      conversationId = createdConversation.id;
    }

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        conversation_id: conversationId,
        sender_type: "user",
        sender_name:
          profile.full_name || profile.email || "Unknown User",
        direction: "Outbound",
        message: messageToSend,
        message_type: "text",
        meta_message_id: metaMessageId,
        delivery_status: "Sent",
        created_at: messageDate,
      })
      .select("*")
      .single();

    if (saveError) {
      alert(
        "Message sent, but failed to save in CRM: " +
          saveError.message
      );
      return;
    }

    await addActivity(
      "WhatsApp Sent",
      messageToSend,
      "whatsapp",
      "green"
    );

    if (savedMessage) {
      setWhatsappMessages((current) => [
        ...current,
        savedMessage,
      ]);
    }

    setWhatsappInput("");

    alert("WhatsApp message sent successfully.");
  } catch (error) {
    console.error("Unexpected WhatsApp send error:", error);
    alert("Unexpected error sending WhatsApp message.");
  } finally {
    setSendingWhatsapp(false);
  }
}


  async function fetchLinkedDealSnapshot() {
    if (!profile?.company_id || !leadId) return;

    setLoadingLinkedDeal(true);

    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, lead_id, vehicle_id, customer_name, vehicle_name, sale_price, deposit_amount, trade_in_value, settlement_amount, extras_amount, discount_amount, deal_stage, finance_status, prep_started_at, planned_delivery_at, ready_for_delivery_at, delivered_at, created_at"
      )
      .eq("company_id", profile.company_id)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error loading linked deal:", error.message);
      setLinkedDealSnapshot(null);
    } else {
      setLinkedDealSnapshot(
        (data as LeadDealSnapshot | null) || null
      );
    }

    setLoadingLinkedDeal(false);
  }

  async function fetchDealChecklist(
    dealId: number
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
        "Error loading deal checklist on lead:",
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

  function openDealModal() {
    if (!lead) return;

    const latestAssessment =
      affordabilityAssessments[0] || null;

    setDealSalePrice(
      linkedDealSnapshot?.sale_price !== null &&
      linkedDealSnapshot?.sale_price !== undefined
        ? String(linkedDealSnapshot.sale_price)
        : latestAssessment?.selected_vehicle_price !== null &&
          latestAssessment?.selected_vehicle_price !== undefined
        ? String(latestAssessment.selected_vehicle_price)
        : linkedVehicle?.price !== null &&
          linkedVehicle?.price !== undefined
        ? String(linkedVehicle.price)
        : vehiclePrice || ""
    );

    setDealDeposit(
      linkedDealSnapshot?.deposit_amount !== null &&
      linkedDealSnapshot?.deposit_amount !== undefined
        ? String(linkedDealSnapshot.deposit_amount)
        : latestAssessment
        ? String(latestAssessment.deposit_amount)
        : deposit || ""
    );

    setDealTradeIn(
      linkedDealSnapshot?.trade_in_value !== null &&
      linkedDealSnapshot?.trade_in_value !== undefined
        ? String(linkedDealSnapshot.trade_in_value)
        : ""
    );

    setDealSettlement(
      linkedDealSnapshot?.settlement_amount !== null &&
      linkedDealSnapshot?.settlement_amount !== undefined
        ? String(linkedDealSnapshot.settlement_amount)
        : ""
    );

    setDealExtras(
      linkedDealSnapshot?.extras_amount !== null &&
      linkedDealSnapshot?.extras_amount !== undefined
        ? String(linkedDealSnapshot.extras_amount)
        : ""
    );

    setDealDiscount(
      linkedDealSnapshot?.discount_amount !== null &&
      linkedDealSnapshot?.discount_amount !== undefined
        ? String(linkedDealSnapshot.discount_amount)
        : ""
    );

    setDealNotes(
      linkedDealSnapshot
        ? ""
        : latestAssessment?.notes || ""
    );

    setShowDealModal(true);
  }

  async function reserveDealVehicle(
    vehicleId: number | null
  ) {
    if (
      !vehicleId ||
      !profile?.company_id ||
      !lead
    ) {
      return;
    }

    const { error } = await supabase
      .from("inventory_vehicles")
      .update({
        linked_lead_id: lead.id,
        linked_customer_name: lead.customer,
        status:
          linkedVehicle?.status === "Sold" ||
          linkedVehicle?.status === "Delivered"
            ? linkedVehicle.status
            : "Reserved",
      })
      .eq("id", vehicleId)
      .eq("company_id", profile.company_id);

    if (error) {
      console.error(
        "Deal saved, but vehicle reservation could not be updated:",
        error.message
      );
    }
  }

  async function saveDealFromLead() {
    if (
      !lead ||
      !profile?.company_id ||
      !profile?.id
    ) {
      return;
    }

    const salePrice = Number(dealSalePrice) || 0;

    if (salePrice <= 0) {
      alert("Please enter a valid sale price.");
      return;
    }

    const vehicleId =
      linkedVehicle?.id ||
      affordabilityAssessments[0]
        ?.selected_vehicle_id ||
      linkedDealSnapshot?.vehicle_id ||
      null;

    const vehicleName =
      linkedVehicle
        ? formatVehicleTitle(linkedVehicle)
        : lead.vehicle ||
          linkedDealSnapshot?.vehicle_name ||
          "Vehicle not selected";

    setSavingDeal(true);

    try {
      const activeStages = [
        "Draft",
        "Offer Sent",
        "Finance Submitted",
        "Finance Approved",
        "Sale Pending",
        "Ready for Delivery",
      ];

      const { data: existingActiveDeal, error: lookupError } =
        await supabase
          .from("deals")
          .select(
            "id, deal_stage, finance_status, notes"
          )
          .eq("company_id", profile.company_id)
          .eq("lead_id", lead.id)
          .in("deal_stage", activeStages)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (lookupError) {
        alert(
          "Could not check for an existing deal: " +
            lookupError.message
        );
        return;
      }

      const latestAssessment =
        affordabilityAssessments[0] || null;

      const noteParts = [
        existingActiveDeal?.notes || null,
        dealNotes.trim() || null,
        latestAssessment
          ? `Latest affordability assessment #${latestAssessment.id}`
          : null,
      ].filter(Boolean);

      const payload = {
        company_id: profile.company_id,
        lead_id: lead.id,
        vehicle_id: vehicleId,
        customer_name: lead.customer,
        vehicle_name: vehicleName,
        sale_price: salePrice,
        deposit_amount:
          Number(dealDeposit) || 0,
        trade_in_value:
          Number(dealTradeIn) || 0,
        settlement_amount:
          Number(dealSettlement) || 0,
        extras_amount:
          Number(dealExtras) || 0,
        discount_amount:
          Number(dealDiscount) || 0,
        assigned_user_id:
          lead.assigned_user_id ||
          profile.id,
        notes:
          noteParts.join(" • ") || null,
        updated_at:
          new Date().toISOString(),
      };

      let savedDealId: number;
      let actionTitle: string;

      if (existingActiveDeal) {
        const { data, error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", existingActiveDeal.id)
          .eq("company_id", profile.company_id)
          .select("id")
          .single();

        if (error || !data) {
          alert(
            "Error updating deal: " +
              (error?.message ||
                "Unknown error")
          );
          return;
        }

        savedDealId = data.id;
        actionTitle = "Deal Updated";
      } else {
        const financeStatus =
          lead.finance === "Approved"
            ? "Approved"
            : lead.finance === "Submitted" ||
              financeApplicationId
            ? "Submitted"
            : "Not Started";

        const dealStage =
          financeStatus === "Approved"
            ? "Finance Approved"
            : financeStatus === "Submitted"
            ? "Finance Submitted"
            : "Draft";

        const { data, error } = await supabase
          .from("deals")
          .insert({
            ...payload,
            deal_stage: dealStage,
            finance_status: financeStatus,
          })
          .select("id")
          .single();

        if (error || !data) {
          alert(
            "Error creating deal: " +
              (error?.message ||
                "Unknown error")
          );
          return;
        }

        savedDealId = data.id;
        actionTitle = "Deal Created";
      }

      await reserveDealVehicle(vehicleId);

      await addActivity(
        actionTitle,
        [
          `Deal #${savedDealId}`,
          vehicleName,
          `Sale price: ${formatRand(
            salePrice
          )}`,
          `Deposit: ${formatRand(
            Number(dealDeposit) || 0
          )}`,
          latestAssessment
            ? `Assessment #${latestAssessment.id}`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        "deal",
        existingActiveDeal
          ? "blue"
          : "green"
      );

      setShowDealModal(false);
      await fetchLinkedDealSnapshot();

      alert(
        existingActiveDeal
          ? `Deal #${savedDealId} updated successfully.`
          : `Draft Deal #${savedDealId} created successfully.`
      );
    } finally {
      setSavingDeal(false);
    }
  }

  async function createOrUpdateDealFromAssessment(
    assessment: AffordabilityAssessment
  ) {
    if (
      !lead ||
      !profile?.company_id ||
      !profile?.id
    ) {
      return;
    }

    const confirmed = window.confirm(
      linkedDealSnapshot
        ? "The assessment was saved. Update the current active Deal with these affordability values?"
        : "The assessment was saved. Create a Draft Deal from this assessment?"
    );

    if (!confirmed) return;

    const activeStages = [
      "Draft",
      "Offer Sent",
      "Finance Submitted",
      "Finance Approved",
      "Ready for Delivery",
    ];

    const { data: existingActiveDeal, error: lookupError } =
      await supabase
        .from("deals")
        .select("id, notes")
        .eq("company_id", profile.company_id)
        .eq("lead_id", lead.id)
        .in("deal_stage", activeStages)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (lookupError) {
      alert(
        "Assessment saved, but Deal lookup failed: " +
          lookupError.message
      );
      return;
    }

    const vehicleId =
      assessment.selected_vehicle_id ||
      linkedVehicle?.id ||
      null;

    const vehicleName =
      linkedVehicle
        ? formatVehicleTitle(linkedVehicle)
        : lead.vehicle ||
          "Vehicle not selected";

    const salePrice =
      Number(
        assessment.selected_vehicle_price
      ) ||
      Number(linkedVehicle?.price) ||
      Number(vehiclePrice) ||
      0;

    if (salePrice <= 0) {
      alert(
        "Assessment saved, but a Deal could not be created because no valid vehicle price is available."
      );
      return;
    }

    const commonPayload = {
      company_id: profile.company_id,
      lead_id: lead.id,
      vehicle_id: vehicleId,
      customer_name: lead.customer,
      vehicle_name: vehicleName,
      sale_price: salePrice,
      deposit_amount:
        Number(
          assessment.deposit_amount
        ) || 0,
      assigned_user_id:
        lead.assigned_user_id ||
        profile.id,
      updated_at:
        new Date().toISOString(),
    };

    let savedDealId: number;
    let actionTitle: string;

    if (existingActiveDeal) {
      const notes = [
        existingActiveDeal.notes || null,
        `Updated from affordability assessment #${assessment.id}`,
        assessment.notes || null,
      ]
        .filter(Boolean)
        .join(" • ");

      const { data, error } = await supabase
        .from("deals")
        .update({
          ...commonPayload,
          notes,
        })
        .eq("id", existingActiveDeal.id)
        .eq("company_id", profile.company_id)
        .select("id")
        .single();

      if (error || !data) {
        alert(
          "Assessment saved, but Deal update failed: " +
            (error?.message ||
              "Unknown error")
        );
        return;
      }

      savedDealId = data.id;
      actionTitle = "Deal Updated from Assessment";
    } else {
      const financeStatus =
        lead.finance === "Approved"
          ? "Approved"
          : lead.finance === "Submitted" ||
            financeApplicationId
          ? "Submitted"
          : "Not Started";

      const dealStage =
        financeStatus === "Approved"
          ? "Finance Approved"
          : financeStatus === "Submitted"
          ? "Finance Submitted"
          : "Draft";

      const { data, error } = await supabase
        .from("deals")
        .insert({
          ...commonPayload,
          deal_stage: dealStage,
          finance_status: financeStatus,
          trade_in_value: 0,
          settlement_amount: 0,
          extras_amount: 0,
          discount_amount: 0,
          notes: [
            `Created from affordability assessment #${assessment.id}`,
            assessment.notes || null,
          ]
            .filter(Boolean)
            .join(" • "),
        })
        .select("id")
        .single();

      if (error || !data) {
        alert(
          "Assessment saved, but Draft Deal creation failed: " +
            (error?.message ||
              "Unknown error")
        );
        return;
      }

      savedDealId = data.id;
      actionTitle = "Draft Deal Created from Assessment";
    }

    await reserveDealVehicle(vehicleId);

    await addActivity(
      actionTitle,
      [
        `Deal #${savedDealId}`,
        `Assessment #${assessment.id}`,
        vehicleName,
        `Sale price: ${formatRand(
          salePrice
        )}`,
        `Deposit: ${formatRand(
          assessment.deposit_amount
        )}`,
      ].join(" • "),
      "deal",
      existingActiveDeal
        ? "blue"
        : "green"
    );

    await fetchLinkedDealSnapshot();

    alert(
      existingActiveDeal
        ? `Deal #${savedDealId} updated from the assessment.`
        : `Draft Deal #${savedDealId} created from the assessment.`
    );
  }

  async function submitToFinance() {
  if (
    !lead ||
    !profile?.company_id ||
    !profile?.id
  ) {
    return;
  }

  const {
    data: existingApplication,
    error: checkError,
  } = await supabase
    .from("finance_applications")
    .select("id")
    .eq("lead_id", lead.id)
    .eq(
      "company_id",
      profile.company_id
    )
    .maybeSingle();

  if (checkError) {
    alert(
      "Error checking finance application: " +
        checkError.message
    );
    return;
  }

  if (existingApplication) {
    alert(
      "This lead has already been submitted to finance."
    );
    return;
  }

  /*
   * Load the latest saved assessment.
   */
  const {
    data: latestAssessment,
    error: assessmentError,
  } = await supabase
    .from("lead_affordability_assessments")
    .select(
      "id, target_monthly_installment, deposit_amount, maximum_vehicle_price, selected_vehicle_id, selected_vehicle_price, estimated_installment, created_at"
    )
    .eq(
      "company_id",
      profile.company_id
    )
    .eq("lead_id", lead.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (assessmentError) {
    alert(
      "Could not load the latest affordability assessment: " +
        assessmentError.message
    );
    return;
  }

  /*
   * Load the latest linked deal.
   */
  const {
    data: latestDeal,
    error: dealError,
  } = await supabase
    .from("deals")
    .select(
      "id, lead_id, vehicle_id, customer_name, vehicle_name, sale_price, deposit_amount, trade_in_value, settlement_amount, extras_amount, discount_amount, deal_stage, finance_status, created_at"
    )
    .eq(
      "company_id",
      profile.company_id
    )
    .eq("lead_id", lead.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (dealError) {
    alert(
      "Could not load the linked deal: " +
        dealError.message
    );
    return;
  }

  /*
   * Prefer Deal values.
   * Fall back to the assessment when no Deal exists.
   */
  const dealSnapshot =
    latestDeal as LeadDealSnapshot | null;

  const requestedAmount =
    dealSnapshot
      ? calculateDealFinanceAmount(
          dealSnapshot
        )
      : Math.max(
          Number(
            latestAssessment
              ?.selected_vehicle_price
          ) -
            Number(
              latestAssessment
                ?.deposit_amount
            ),
          0
        );

  const submissionDeposit =
    dealSnapshot
      ? Number(
          dealSnapshot.deposit_amount
        ) || 0
      : Number(
          latestAssessment
            ?.deposit_amount
        ) || 0;

  const monthlyBudget =
    Number(
      latestAssessment
        ?.target_monthly_installment
    ) || 0;

  const submittedVehicle =
    dealSnapshot?.vehicle_name ||
    lead.vehicle ||
    "Vehicle not selected";

  const financeNotesParts = [
    "Finance application submitted from lead detail page.",

    latestAssessment?.id
      ? `Assessment #${latestAssessment.id} used`
      : "No affordability assessment found",

    dealSnapshot?.id
      ? `Deal #${dealSnapshot.id} used`
      : "No linked deal found",

    `Submitted by ${
      profile.full_name ||
      profile.email ||
      "Unknown User"
    }`,
  ];

  const {
    data: createdApplication,
    error: financeError,
  } = await supabase
    .from("finance_applications")
    .insert({
      lead_id: lead.id,
      customer: lead.customer,
      vehicle: submittedVehicle,

      requested_amount:
        requestedAmount,

      deposit:
        submissionDeposit,

      monthly_budget:
        monthlyBudget,

      finance_status:
        "Submitted",

      bank:
        "Pending bank allocation",

      company_id:
        profile.company_id,

      finance_notes:
        financeNotesParts.join(" • "),

      submitted_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (
    financeError ||
    !createdApplication
  ) {
    alert(
      "Error submitting to finance: " +
        (
          financeError?.message ||
          "Unknown error"
        )
    );
    return;
  }

  const { error: leadError } =
    await supabase
      .from("leads")
      .update({
        finance: "Submitted",
        status:
          "Submitted to Finance",
      })
      .eq("id", lead.id)
      .eq(
        "company_id",
        profile.company_id
      );

  if (leadError) {
    alert(
      "Finance application was created, but the lead could not be updated: " +
        leadError.message
    );
    return;
  }

  if (dealSnapshot?.id) {
    const { error: dealUpdateError } =
      await supabase
        .from("deals")
        .update({
          deal_stage:
            "Finance Submitted",

          finance_status:
            "Submitted",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          dealSnapshot.id
        )
        .eq(
          "company_id",
          profile.company_id
        );

    if (dealUpdateError) {
      console.error(
        "Finance submitted, but linked deal could not be updated:",
        dealUpdateError.message
      );
    }
  }

  await addActivity(
    "Submitted to Finance",
    [
      `Requested amount: ${formatRand(
        requestedAmount
      )}`,

      `Deposit: ${formatRand(
        submissionDeposit
      )}`,

      `Monthly budget: ${formatRand(
        monthlyBudget
      )}`,

      latestAssessment?.id
        ? `Assessment #${latestAssessment.id}`
        : "No assessment",

      dealSnapshot?.id
        ? `Deal #${dealSnapshot.id}`
        : "No deal",
    ].join(" • "),
    "Finance",
    "orange"
  );

  setLead((currentLead) =>
    currentLead
      ? {
          ...currentLead,
          finance: "Submitted",
          status:
            "Submitted to Finance",
        }
      : currentLead
  );

  setLeadStatus(
    "Submitted to Finance"
  );

  setFinanceApplicationId(
    createdApplication.id
  );

  await Promise.all([
    fetchLead(),
    fetchActivities(),
    checkFinanceApplication(),
  ]);

  alert(
    "Lead submitted to finance successfully."
  );
}

  async function createTask() {
  if (
    !lead ||
    !profile?.company_id ||
    !profile?.id
  ) {
    return;
  }

  if (!taskTitle.trim() || !taskDueDate) {
    alert(
      "Please enter a task title and due date."
    );
    return;
  }

  let assignedUserId: number;
  let assignedUserName: string;

  if (!canChooseTaskAssignee) {
    assignedUserId = profile.id;

    assignedUserName =
      profile.full_name ||
      profile.email ||
      "Unknown User";
  } else {
    if (taskAssignedUserId === "") {
      alert(
        "Please select the person responsible for this task."
      );
      return;
    }

    const selectedUser = salesUsers.find(
      (user) =>
        user.id === Number(taskAssignedUserId)
    );

    if (!selectedUser) {
      alert(
        "The selected user is not active or could not be found."
      );
      return;
    }

    assignedUserId = selectedUser.id;

    assignedUserName =
      selectedUser.full_name ||
      selectedUser.email ||
      "Unknown User";
  }

  const { data, error } = await supabase.rpc(
    "upsert_workflow_task",
    {
      p_lead_id: lead.id,
      p_assigned_user_id: assignedUserId,
      p_title: taskTitle.trim(),
      p_description:
        taskDescription.trim() || null,
      p_task_type: "Follow-up",
      p_priority: taskPriority,
      p_due_date: new Date(
        taskDueDate
      ).toISOString(),
      p_task_scope: "Sales",
      p_task_reason:
        "CUSTOMER_FOLLOW_UP",
      p_related_record_type: "lead",
      p_related_record_id: lead.id,
      p_use_dedupe: true,
    }
  );

  if (error) {
    alert(
      "Error saving task: " +
        error.message
    );
    return;
  }

  const result = Array.isArray(data)
    ? data[0]
    : data;

  const action =
    result?.task_action || "saved";

  await addActivity(
    action === "created"
      ? "Task Created"
      : action === "reopened"
      ? "Task Reopened"
      : "Task Updated",
    [
      taskTitle.trim(),
      `Assigned to: ${assignedUserName}`,
      `Due: ${new Date(
        taskDueDate
      ).toLocaleString("en-ZA")}`,
      `Lifecycle action: ${action}`,
    ].join(" • "),
    "task",
    action === "created"
      ? "blue"
      : "orange"
  );

  setShowTaskModal(false);
  setTaskTitle("");
  setTaskDescription("");
  setTaskDueDate("");
  setTaskPriority("Medium");
  setTaskAssignedUserId("");

  await fetchLeadTasks();

  alert(
    action === "created"
      ? `Task created and assigned to ${assignedUserName}.`
      : action === "reopened"
      ? `The existing customer follow-up task was reopened and updated for ${assignedUserName}.`
      : `The existing customer follow-up task was updated for ${assignedUserName}.`
  );
}

async function saveCallLog() {
  if (!lead || !profile?.company_id) return;

  if (!callOutcome) {
    alert("Please select a call outcome.");
    return;
  }

  const followUpRequired =
    callOutcome === "Call Back Later";

  if (
    followUpRequired &&
    !callFollowUpDate
  ) {
    alert(
      "Please select a callback date and time."
    );
    return;
  }

  setSavingCall(true);

  try {
    const normalizedPhone =
      normalizePhone(lead.phone);

    const {
      data: savedCall,
      error: callError,
    } = await supabase
      .from("call_logs")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        user_profile_id: profile.id,
        user_name:
          profile.full_name ||
          profile.email ||
          "Unknown User",
        phone_number: normalizedPhone
          ? `+${normalizedPhone}`
          : lead.phone,
        direction: "Outbound",
        outcome: callOutcome,
        notes:
          callNotes.trim() || null,
        follow_up_required:
          followUpRequired,
        follow_up_date:
          followUpRequired &&
          callFollowUpDate
            ? new Date(
                callFollowUpDate
              ).toISOString()
            : null,
      })
      .select("id")
      .single();

    if (
      callError ||
      !savedCall
    ) {
      alert(
        "Error saving call log: " +
          (
            callError?.message ||
            "Unknown error"
          )
      );
      return;
    }

    let followUpTaskId:
      | number
      | null = null;

    let taskLifecycleAction:
      | string
      | null = null;

    if (
      followUpRequired &&
      callFollowUpDate
    ) {
      const assignedUserId =
        lead.assigned_user_id ||
        profile.id;

      const assignedUserName =
        lead.assigned_user_name ||
        profile.full_name ||
        profile.email ||
        "Unknown User";

      const { data, error } =
        await supabase.rpc(
          "upsert_workflow_task",
          {
            p_lead_id: lead.id,
            p_assigned_user_id:
              assignedUserId,
            p_title:
              `Call back ${lead.customer}`,
            p_description:
              callNotes.trim() ||
              `Callback requested after outbound call to ${lead.customer}.`,
            p_task_type: "Follow-up",
            p_priority: "High",
            p_due_date: new Date(
              callFollowUpDate
            ).toISOString(),
            p_task_scope: "Sales",
            p_task_reason: "CALLBACK",
            p_related_record_type:
              "lead",
            p_related_record_id:
              lead.id,
            p_use_dedupe: true,
          }
        );

      if (error) {
        alert(
          "Call log saved, but callback task could not be saved: " +
            error.message
        );
      } else {
        const result =
          Array.isArray(data)
            ? data[0]
            : data;

        followUpTaskId =
          result?.task_id || null;

        taskLifecycleAction =
          result?.task_action ||
          "saved";

        if (followUpTaskId) {
          const { error: linkError } =
            await supabase
              .from("call_logs")
              .update({
                follow_up_task_id:
                  followUpTaskId,
              })
              .eq(
                "id",
                savedCall.id
              )
              .eq(
                "company_id",
                profile.company_id
              );

          if (linkError) {
            console.error(
              "Call saved, but task link could not be updated:",
              linkError.message
            );
          }
        }
      }
    }

    if (
      callOutcome === "Answered"
    ) {
      const {
        error: completionError,
      } = await supabase.rpc(
        "complete_workflow_task",
        {
          p_lead_id: lead.id,
          p_task_scope: "Sales",
          p_task_reason: "CALLBACK",
          p_related_record_type:
            "lead",
          p_related_record_id:
            lead.id,
        }
      );

      if (completionError) {
        console.error(
          "Call logged, but existing callback task could not be completed:",
          completionError.message
        );
      }
    }

    const activityDescription = [
      `Outcome: ${callOutcome}`,
      callNotes.trim()
        ? `Notes: ${callNotes.trim()}`
        : null,
      followUpRequired &&
      callFollowUpDate
        ? `Callback: ${new Date(
            callFollowUpDate
          ).toLocaleString("en-ZA")}`
        : null,
      taskLifecycleAction
        ? `Callback task: ${taskLifecycleAction}`
        : null,
      callOutcome === "Answered"
        ? "Existing callback task completed where applicable"
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    await addActivity(
      "Call Logged",
      activityDescription,
      "call",
      callOutcome === "Answered"
        ? "green"
        : "orange"
    );

    if (callCommunicationLogId) {
      const finalStatus =
        followUpTaskId
          ? "Follow-up Created"
          : callOutcome === "Answered"
          ? "Closed"
          : callOutcome === "No Answer"
          ? "No Answer"
          : "Closed";

      const { error: communicationUpdateError } = await supabase
        .from("communication_logs")
        .update({
          outcome: callOutcome,
          summary: callNotes.trim() || activityDescription,
          send_status: finalStatus,
          follow_up_task_id: followUpTaskId,
          sent_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
        })
        .eq("id", callCommunicationLogId)
        .eq("company_id", profile.company_id);

      if (communicationUpdateError) {
        console.error(
          "Call logged, but communication outcome could not be updated:",
          communicationUpdateError.message
        );
      }
    }


    await Promise.all([
      fetchLeadTasks(),
      fetchCallLogs(),
      fetchCommunicationLogs(),
      fetchLead(),
    ]);

    window.dispatchEvent(
      new CustomEvent(
        "dealflow-task-updated"
      )
    );

    setShowCallModal(false);
    setCallOutcome("");
    setCallNotes("");
    setCallFollowUpDate("");
    setCallCommunicationLogId(null);

    alert(
      followUpTaskId
        ? taskLifecycleAction ===
          "created"
          ? "Call logged and callback task created successfully."
          : taskLifecycleAction ===
            "reopened"
          ? "Call logged and the existing callback task was reopened with the new date."
          : "Call logged and the existing callback task was updated with the new date."
        : callOutcome ===
          "Answered"
        ? "Call logged and any open callback task was completed."
        : "Call logged successfully."
    );
  } catch (error) {
    console.error(
      "Unexpected call log error:",
      error
    );

    alert(
      "Unexpected error saving the call log."
    );
  } finally {
    setSavingCall(false);
  }
}


async function saveAffordabilityAssessment() {
  if (!lead || !profile?.company_id) return;

  if (targetInstallmentNumber <= 0) {
    alert("Please enter a valid target monthly instalment.");
    return;
  }

  if (termNumber <= 0) {
    alert("Please select a valid finance term.");
    return;
  }

  if (maximumAffordableVehiclePrice <= 0) {
    alert("The affordability calculation is not valid.");
    return;
  }

  setSavingAssessment(true);

  try {
    const selectedVehicleId = linkedVehicle?.id || null;
    const selectedVehiclePrice = linkedVehicle?.price || null;

    const selectedVehicleInstallment =
      selectedVehiclePrice !== null
        ? calculateMonthlyInstallment(
            Number(selectedVehiclePrice),
            depositNumber,
            rateNumber,
            termNumber,
            balloonNumber
          )
        : null;

    const { data: savedAssessment, error } = await supabase
      .from("lead_affordability_assessments")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        created_by_id: profile.id,
        created_by_name:
          profile.full_name || profile.email || "Unknown User",
        target_monthly_installment: targetInstallmentNumber,
        deposit_amount: depositNumber,
        interest_rate: rateNumber,
        term_months: termNumber,
        balloon_percentage: balloonNumber,
        maximum_vehicle_price: maximumAffordableVehiclePrice,
        selected_vehicle_id: selectedVehicleId,
        selected_vehicle_price: selectedVehiclePrice,
        estimated_installment: selectedVehicleInstallment,
        notes: assessmentNotes.trim() || null,
      })
      .select("*")
      .single();

    if (error || !savedAssessment) {
      alert(
        "Error saving affordability assessment: " +
          (error?.message || "Unknown error")
      );
      return;
    }

    await addActivity(
      "Affordability Assessment Saved",
      [
        `Target instalment: ${formatRand(
          targetInstallmentNumber
        )}/month`,
        `Maximum vehicle price: ${formatRand(
          maximumAffordableVehiclePrice
        )}`,
        `Deposit: ${formatRand(depositNumber)}`,
        `Interest: ${rateNumber}%`,
        `Term: ${termNumber} months`,
        `Balloon: ${balloonNumber}%`,
        linkedVehicle
          ? `Selected vehicle: ${formatVehicleTitle(linkedVehicle)}`
          : null,
        assessmentNotes.trim()
          ? `Notes: ${assessmentNotes.trim()}`
          : null,
      ]
        .filter(Boolean)
        .join(" • "),
      "calculator",
      "orange"
    );

    setAffordabilityAssessments((current) => [
      savedAssessment,
      ...current,
    ]);

    setAssessmentNotes("");

    alert("Affordability assessment saved successfully.");

    await createOrUpdateDealFromAssessment(
      savedAssessment as AffordabilityAssessment
    );
  } catch (error) {
    console.error("Unexpected affordability save error:", error);
    alert("Unexpected error saving affordability assessment.");
  } finally {
    setSavingAssessment(false);
  }
}

  async function fetchSalesUsers() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", profile.company_id)
      .in("role", ["Sales", "Manager", "Admin"])
      .eq("status", "Active")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading sales users:", error.message);
      setSalesUsers([]);
      return;
    }

    setSalesUsers(Array.isArray(data) ? data : []);
  }

  async function fetchLead() {
    setLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("company_id", profile?.company_id);

    if (profile?.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      console.error("Lead not found or access denied:", error?.message);
      setLead(null);
      setLoading(false);
      return;
    }

    setLead(data);
    setLeadStatus(data.status || "New Lead");
    setAssignedUserId(data.assigned_user_id || "");
    setLoading(false);
  }

  async function reassignLead(newUserId: number) {
    if (!lead || !profile?.company_id) return;

    const selectedUser = salesUsers.find((user) => user.id === newUserId);

    if (!selectedUser) {
      alert("Selected user not found.");
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({
        assigned_user_id: selectedUser.id,
        assigned_user_name:
          selectedUser.full_name || selectedUser.email || "Unknown User",
      })
      .eq("id", lead.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error reassigning lead: " + error.message);
      return;
    }

    await addActivity(
      "Lead Reassigned",
      `Lead assigned to ${
        selectedUser.full_name || selectedUser.email || "Unknown User"
      }`,
      "assignment",
      "blue"
    );

    setAssignedUserId(selectedUser.id);
    fetchLead();
  }

  async function fetchActivities() {
    const { data, error } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile?.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading activities:", error.message);
    } else {
      setTimeline(data || []);
    }
  }

async function fetchCallLogs() {
  if (!profile?.company_id) return;

  setLoadingCallLogs(true);

  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .eq("lead_id", leadId)
    .eq("company_id", profile.company_id)
    .order("called_at", { ascending: false });

  if (error) {
    console.error("Error loading call logs:", error.message);
    setCallLogs([]);
  } else {
    setCallLogs(Array.isArray(data) ? data : []);
  }

  setLoadingCallLogs(false);
}

async function fetchAffordabilityAssessments() {
  if (!profile?.company_id) return;

  setLoadingAssessments(true);

  const { data, error } = await supabase
    .from("lead_affordability_assessments")
    .select("*")
    .eq("lead_id", leadId)
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Error loading affordability assessments:",
      error.message
    );
    setAffordabilityAssessments([]);
  } else {
    setAffordabilityAssessments(
      Array.isArray(data) ? data : []
    );
  }

  setLoadingAssessments(false);
}

  async function addActivity(
    title: string,
    description: string,
    activityType: string,
    color: string
  ) {
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      title,
      description,
      activity_type: activityType,
      color,
      company_id: profile?.company_id,
    });

    if (error) {
      alert("Error saving activity: " + error.message);
      return;
    }

    fetchActivities();
  }


  async function fetchCommunicationLogs() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading communication logs:", error.message);
      setCommunicationLogs([]);
      return;
    }

    setCommunicationLogs(Array.isArray(data) ? data : []);
  }

  function openCommunicationModal(
    channel: "WhatsApp" | "Email",
    templateKey = "follow_up"
  ) {
    if (!lead) return;

    const selectedOffer =
      financeBankOffers.find((offer) => offer.is_selected) ||
      financeBankOffers.find((offer) => offer.status === "Approved") ||
      null;

    const template = buildCommunicationTemplate({
      templateKey,
      channel,
      lead,
      vehicleTitle: linkedVehicleTitle,
      deal: linkedDealSnapshot,
      financeOffer: selectedOffer,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        lead.assigned_user_name ||
        "Sales",
    });

    setCommunicationChannel(channel);
    setCommunicationTemplateKey(templateKey);
    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
    setShowCommunicationModal(true);
  }

  function handleCommunicationTemplateChange(templateKey: string) {
    if (!lead) return;

    setCommunicationTemplateKey(templateKey);

    const selectedOffer =
      financeBankOffers.find((offer) => offer.is_selected) ||
      financeBankOffers.find((offer) => offer.status === "Approved") ||
      null;

    const template = buildCommunicationTemplate({
      templateKey,
      channel: communicationChannel,
      lead,
      vehicleTitle: linkedVehicleTitle,
      deal: linkedDealSnapshot,
      financeOffer: selectedOffer,
      salespersonName:
        profile?.full_name ||
        profile?.email ||
        lead.assigned_user_name ||
        "Sales",
    });

    setCommunicationSubject(template.subject);
    setCommunicationMessage(template.body);
  }

  async function startCommunicationAction() {
    if (!lead || !profile?.company_id || !profile?.id) return;

    const customerPhone = normalizePhone(lead.phone);
    const customerEmail = lead.email || "";

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
          lead_id: lead.id,
          deal_id: linkedDealSnapshot?.id || null,
          finance_application_id: financeApplicationId,
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
          customer_name: lead.customer,
          customer_phone: lead.phone,
          customer_email: lead.email,
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

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      setCommunicationFollowUpDate(
        `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T09:00`
      );

      if (communicationChannel === "WhatsApp") {
        /*
         * Use the WhatsApp app protocol first so desktop/mobile users with the
         * WhatsApp app installed are not also forced through a browser tab.
         *
         * Browsers cannot reliably detect whether the WhatsApp desktop/mobile app
         * is installed, so we do not auto-open a web fallback here. The outcome
         * modal provides a manual WhatsApp Web fallback link if the app does not open.
         */
        const appUrl = `whatsapp://send?phone=${customerPhone}&text=${encodeURIComponent(
          communicationMessage.trim()
        )}`;

        window.location.href = appUrl;
      } else {
        const mailto = `mailto:${encodeURIComponent(
          customerEmail
        )}?subject=${encodeURIComponent(
          communicationSubject.trim() || "DealFlow message"
        )}&body=${encodeURIComponent(communicationMessage.trim())}`;

        /*
         * mailto should open the user's default mail app in the current browser
         * context. Do not open about:blank first because it creates an unnecessary
         * blank tab when Outlook/Gmail desktop handling is available.
         */
        window.location.href = mailto;
      }

      await addActivity(
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
        "communication",
        "orange"
      );

      setShowCommunicationModal(false);
      setShowCommunicationOutcomeModal(true);
      await fetchCommunicationLogs();
    } finally {
      setSavingCommunication(false);
    }
  }

  async function resolveCommunicationOutcome() {
    if (!activeCommunicationLog || !lead || !profile?.company_id || !profile?.id) {
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
            p_lead_id: lead.id,
            p_assigned_user_id:
              lead.assigned_user_id || profile.id,
            p_title:
              `Follow up after ${activeCommunicationLog.channel}: ${lead.customer}`,
            p_description:
              communicationSummary.trim() ||
              `Follow up on ${activeCommunicationLog.channel} communication with ${lead.customer}.`,
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
            /*
             * Dedupe communication follow-up tasks at Lead + Channel level.
             * A new WhatsApp or Email communication outcome should update/reopen
             * the existing matching follow-up task instead of creating duplicates.
             */
            p_related_record_type: "lead",
            p_related_record_id: lead.id,
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

      await addActivity(
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
        "communication",
        finalStatus === "Not Sent" || finalStatus === "No Answer"
          ? "orange"
          : "green"
      );

      await Promise.all([
        fetchCommunicationLogs(),
        fetchLead(),
        fetchLeadTasks(),
      ]);

      window.dispatchEvent(
        new CustomEvent("dealflow-task-updated")
      );

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

  async function saveManualCommunicationLog() {
    if (!lead || !profile?.company_id || !profile?.id) return;

    if (!communicationOutcome) {
      alert("Please select an outcome.");
      return;
    }

    setSavingCommunication(true);

    try {
      const { data, error } = await supabase
        .from("communication_logs")
        .insert({
          company_id: profile.company_id,
          lead_id: lead.id,
          deal_id: linkedDealSnapshot?.id || null,
          finance_application_id: financeApplicationId,
          channel: communicationChannel,
          direction: "Inbound",
          template_key: "manual_outcome",
          subject:
            communicationChannel === "Email"
              ? communicationSubject.trim() || null
              : null,
          message_body: communicationMessage.trim() || null,
          outcome: communicationOutcome,
          summary: communicationSummary.trim() || null,
          send_status: "Closed",
          customer_name: lead.customer,
          customer_phone: lead.phone,
          customer_email: lead.email,
          created_by_id: profile.id,
          created_by_name:
            profile.full_name || profile.email || "Unknown User",
          sent_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error || !data) {
        alert(
          "Could not save communication outcome: " +
            (error?.message || "Unknown error")
        );
        return;
      }

      await addActivity(
        `${communicationChannel} Reply / Outcome Logged`,
        [
          `Outcome: ${communicationOutcome}`,
          communicationSummary.trim()
            ? `Summary: ${communicationSummary.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
        "communication",
        "blue"
      );

      await Promise.all([
        fetchCommunicationLogs(),
        fetchLead(),
      ]);

      setShowCommunicationOutcomeModal(false);
      setActiveCommunicationLog(null);
      setCommunicationMessage("");
      setCommunicationSubject("");
      setCommunicationSummary("");
      setCommunicationOutcome("Sent");
    } finally {
      setSavingCommunication(false);
    }
  }

  async function fetchFinanceBankOffers(applicationId: number) {
    if (!profile?.company_id) return;

    setLoadingFinanceBankOffers(true);

    const { data, error } = await supabase
      .from("finance_bank_offers")
      .select("id, finance_application_id, bank_name, status, approved_amount, interest_rate, deposit_amount, term_months, balloon_percentage, monthly_installment, approval_expiry_date, conditions, notes, response_date, is_selected, selected_at, selected_by_name")
      .eq("company_id", profile.company_id)
      .eq("finance_application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading finance bank offers:", error.message);
      setFinanceBankOffers([]);
    } else {
      setFinanceBankOffers(Array.isArray(data) ? data : []);
    }

    setLoadingFinanceBankOffers(false);
  }

  async function selectFinanceOfferForCustomer(
    offer: FinanceBankOffer
  ) {
    const confirmed = window.confirm(
      `Confirm that ${lead?.customer || "the customer"} selected the ${offer.bank_name} offer?`
    );

    if (!confirmed) return;

    setSelectingFinanceOfferId(offer.id);

    const { error } = await supabase.rpc(
      "select_finance_bank_offer",
      { p_offer_id: offer.id }
    );

    setSelectingFinanceOfferId(null);

    if (error) {
      alert("Could not select the finance offer: " + error.message);
      return;
    }

    if (financeApplicationId) {
      await fetchFinanceBankOffers(financeApplicationId);
    }

    await Promise.all([
      fetchLinkedDealSnapshot(),
      fetchLinkedInventoryVehicle(),
    ]);

    window.dispatchEvent(new CustomEvent("dealflow-task-updated"));

    alert(`${offer.bank_name} was selected successfully.`);
  }

  async function checkFinanceApplication() {
    const { data, error } = await supabase
      .from("finance_applications")
      .select("id")
      .eq("lead_id", leadId)
      .eq("company_id", profile?.company_id)
      .maybeSingle();

    if (error) {
      console.error("Error checking finance application:", error.message);
      return;
    }

    setFinanceApplicationId(data ? data.id : null);
  }

  async function fetchDocuments() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("finance_documents")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading documents:", error.message);
      setDocuments([]);
      return;
    }

    setDocuments(Array.isArray(data) ? data : []);
  }

  async function uploadDocument(file: File) {
    if (!lead || !profile?.company_id) return;

    if (!documentType.trim()) {
      alert("Please select a document type.");
      return;
    }

    setUploadingDocument(true);

    try {
      const fileExt = file.name.includes(".")
        ? file.name.split(".").pop()
        : "file";
      const safeCustomer = (lead.customer || "customer")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

      const safeDocType = documentType
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

      const fileName = `${safeDocType}-${Date.now()}.${fileExt}`;
      const filePath = `${profile.company_id}/leads/${lead.id}/${safeCustomer}/${fileName}`;

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
          lead_id: lead.id,
          company_id: profile.company_id,
          customer_name: lead.customer,
          uploaded_by: profile.full_name || profile.email || "Unknown User",
          document_type: documentType,
          file_url: publicUrl,
        });

      if (insertError) {
        alert(
          "Document uploaded, but failed to save record: " +
            insertError.message
        );
        return;
      }

      await addActivity(
        "Document Uploaded",
        `${documentType} uploaded for ${lead.customer}`,
        "document",
        "blue"
      );

      await fetchDocuments();
      alert("Document uploaded successfully.");
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Unexpected error uploading document.");
    } finally {
      setUploadingDocument(false);
    }
  }

  useEffect(() => {
    if (!leadId || !profile?.company_id) return;

    fetchLead();
    fetchActivities();
    checkFinanceApplication();
    fetchSalesUsers();
    fetchWhatsappMessages();
    fetchCallLogs();
    fetchDocuments();
    fetchLeadTasks();
    fetchLinkedInventoryVehicle();
    fetchInventoryVehicles();
    fetchAffordabilityAssessments();
    fetchLinkedDealSnapshot();
    fetchCommunicationLogs();
  }, [leadId, profile?.company_id]);

  useEffect(() => {
    if (!financeApplicationId || !profile?.company_id) {
      setFinanceBankOffers([]);
      return;
    }

    void fetchFinanceBankOffers(financeApplicationId);
  }, [financeApplicationId, profile?.company_id]);

  useEffect(() => {
    if (!linkedDealSnapshot?.id || !profile?.company_id) {
      setDealChecklistItems([]);
      return;
    }

    void fetchDealChecklist(linkedDealSnapshot.id);
  }, [linkedDealSnapshot?.id, profile?.company_id]);

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
    !linkedDealSnapshot
      ? "No Deal"
      : dealChecklistItems.length === 0
      ? "Checklist Not Started"
      : checklistProgress === 100
      ? "Ready"
      : "In Progress";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-6 shadow">Loading lead...</div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-10 shadow">
          <h1 className="text-2xl font-bold text-slate-800">Lead Not Found</h1>
          <p className="mt-3 text-slate-500">
            You do not have permission to view this lead, or it no longer
            exists.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const linkedVehicleTitle = formatVehicleTitle(linkedVehicle);

 return (
  <DashboardLayout>
    <PageAccessGuard module="leadDetail">
      <ReadOnlyNotice />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/customers/${lead.id}`}
                  className="group inline-flex items-center gap-2"
                  title="Open Customer 360"
                >
                  <h1 className="text-3xl font-bold text-slate-800 group-hover:text-blue-700">
                    {lead.customer}
                  </h1>

                  <span
                    aria-hidden="true"
                    className="text-lg font-bold text-slate-400 transition group-hover:text-blue-600"
                  >
                    ↗
                  </span>
                </Link>
                <p className="mt-1 text-slate-500">
                  Interested in {lead.vehicle || "No vehicle selected"}
                </p>
              </div>

              <select
                value={leadStatus}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  setLeadStatus(newStatus);

                  const { error } = await supabase
                    .from("leads")
                    .update({ status: newStatus })
                    .eq("id", leadId)
                    .eq("company_id", profile?.company_id);

                  if (error) {
                    alert("Error updating lead status: " + error.message);
                    return;
                  }

                  await addActivity(
                    "Lead Status Updated",
                    `Status changed to ${newStatus}`,
                    "status",
                    "blue"
                  );
                }}
                className="rounded-full border border-blue-300 bg-blue-100 px-4 py-2 text-sm brand-accent-text"
              >
                <option>New Lead</option>
                <option>Attempted Contact</option>
                <option>Interested</option>
                <option>Test Drive Booked</option>
                <option>Finance Docs Pending</option>
                <option>Submitted to Finance</option>
                <option>Approved</option>
                <option>Declined</option>
                <option>Deal Closed</option>
              </select>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
  <p className="text-sm text-slate-500">Phone Number</p>

  {lead.phone ? (
    <WriteAccessGuard
      fallback={
        <p className="mt-1 text-lg font-medium text-slate-800">
          {lead.phone}
        </p>
      }
    >
      <button
        type="button"
        onClick={startCustomerCall}
        className="mt-1 text-left text-lg font-medium text-blue-700 hover:text-blue-500 hover:underline"
        title="Call customer and log the outcome"
      >
        {lead.phone}
      </button>
    </WriteAccessGuard>
  ) : (
    <p className="mt-1 text-lg font-medium text-slate-500">
      No phone captured
    </p>
  )}
</div>

              <div>
                <p className="text-sm text-slate-500">Assigned To</p>

                {profile?.role === "Admin" || profile?.role === "Manager" ? (
                  <select
                    value={assignedUserId}
                    onChange={(e) => {
                      const newUserId = Number(e.target.value);
                      setAssignedUserId(newUserId);
                      reassignLead(newUserId);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {salesUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-lg font-medium text-slate-800">
                    {lead.assigned_user_name ||
                      lead.salesperson ||
                      "Unassigned"}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-slate-500">Budget</p>
                <p className="mt-1 text-lg font-medium text-slate-800">
                  {lead.budget || "Not captured"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Finance Status</p>
                <span className="mt-1 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                  {lead.finance || "Not Submitted"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Communication Assist
                </h2>
                <p className="text-sm text-slate-500">
                  Track every customer contact attempt, even when WhatsApp, email or calls happen outside DealFlow.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openCommunicationModal("WhatsApp", "follow_up")}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Send WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => openCommunicationModal("Email", "follow_up")}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Send Email
                </button>

                <button
                  type="button"
                  onClick={startCustomerCall}
                  className="rounded-lg brand-accent-bg px-4 py-2 text-sm font-semibold text-white"
                >
                  Call
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCommunicationLog(null);
                    setCommunicationChannel("WhatsApp");
                    setCommunicationOutcome("Customer Replied");
                    setCommunicationSubject("");
                    setCommunicationMessage("");
                    setCommunicationSummary("");
                    setCommunicationFollowUpRequired(false);
                    setCommunicationFollowUpDate("");
                    setShowCommunicationOutcomeModal(true);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log Reply / Outcome
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Last Contact
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {lead.last_contacted_at
                    ? new Date(lead.last_contacted_at).toLocaleString("en-ZA")
                    : "No contact logged"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {lead.last_contact_method || "Method not captured"}
                  {lead.last_contact_outcome
                    ? ` • ${lead.last_contact_outcome}`
                    : ""}
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                  Pending Outcomes
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-800">
                  {
                    communicationLogs.filter(
                      (log) => (log.send_status || "Pending Outcome") === "Pending Outcome"
                    ).length
                  }
                </p>
                <p className="text-xs text-orange-700">
                  Started actions still needing confirmation
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                  Total Logged
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-800">
                  {communicationLogs.length}
                </p>
                <p className="text-xs text-blue-700">
                  WhatsApp, email, call and manual outcomes
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {communicationLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <p className="font-semibold text-slate-700">
                    No communication actions logged yet.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Start with WhatsApp, email, call or log an outcome manually.
                  </p>
                </div>
              ) : (
                communicationLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {log.channel}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${communicationStatusBadge(
                              log.send_status
                            )}`}
                          >
                            {log.send_status || "Pending Outcome"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {log.subject ||
                            COMMUNICATION_TEMPLATES.find(
                              (item) => item.key === log.template_key
                            )?.label ||
                            log.template_key ||
                            "Communication action"}
                        </p>

                        {log.summary ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {log.summary}
                          </p>
                        ) : log.message_body ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {log.message_body}
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleString("en-ZA")} by{" "}
                          {log.created_by_name || "Unknown User"}
                        </p>
                      </div>

                      {(log.send_status || "Pending Outcome") ===
                        "Pending Outcome" && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCommunicationLog(log);
                            setCommunicationChannel(
                              log.channel === "Email" ? "Email" : "WhatsApp"
                            );
                            setCommunicationOutcome("Sent");
                            setCommunicationSummary("");
                            setCommunicationFollowUpRequired(false);
                            setCommunicationFollowUpDate("");
                            setShowCommunicationOutcomeModal(true);
                          }}
                          className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Vehicle Interest
                </h2>
                <p className="text-slate-500">
                  Vehicle linked from inventory stock
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {linkedVehicle && (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${vehicleStatusBadge(
                      linkedVehicle.status
                    )}`}
                  >
                    {linkedVehicle.status || "Available"}
                  </span>
                )}

                <button
                  onClick={() => {
                    setSelectedInventoryVehicleId(linkedVehicle?.id || "");
                    setShowVehicleLinkModal(true);
                  }}
                  className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                >
                  {linkedVehicle ? "Change Vehicle" : "Link Vehicle"}
                </button>
              </div>
            </div>

            {!linkedVehicle ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="text-4xl">🚗</div>
                <h3 className="mt-3 text-xl font-bold text-slate-800">
                  No inventory vehicle linked yet
                </h3>
                <p className="mt-2 text-slate-500">
                  Link a vehicle from inventory so the price, mileage, stock code
                  and image display here automatically.
                </p>
                <button
                  onClick={() => setShowVehicleLinkModal(true)}
                  className="mt-5 rounded-lg brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
                >
                  Link Vehicle from Inventory
                </button>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-slate-500">
                  {linkedVehicle.image_url ? (
                    <img
                      src={linkedVehicle.image_url}
                      alt={linkedVehicleTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-4xl">🚗</div>
                      <p className="mt-2 text-sm">No vehicle image</p>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <h3 className="text-xl font-bold text-slate-800">
                    {linkedVehicleTitle}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Stock: {linkedVehicle.stock_code || "-"} • VIN:{" "}
                    {linkedVehicle.vin || "-"}
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">Price</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {formatRand(linkedVehicle.price)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Mileage</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {linkedVehicle.mileage
                          ? `${linkedVehicle.mileage.toLocaleString(
                              "en-ZA"
                            )} km`
                          : "Not captured"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Estimated Installment
                      </p>
                      <p className="text-lg font-semibold text-slate-800">
                        R
                        {estimatedInstallment.toLocaleString("en-ZA", {
                          maximumFractionDigits: 0,
                        })}
                        /month
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Stock Code</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {linkedVehicle.stock_code || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Colour</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {linkedVehicle.colour || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Location</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {linkedVehicle.location || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/inventory"
                      className="rounded-lg brand-primary-bg px-4 py-2 text-sm font-semibold text-white"
                    >
                      Open Inventory
                    </Link>

                    <button
                      onClick={() => setShowVehicleLinkModal(true)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Change Linked Vehicle
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold text-slate-800">
              Activity Timeline
            </h2>

            <div className="mt-6 space-y-5">
              {timeline.length === 0 && (
                <p className="text-slate-500">No activity recorded yet.</p>
              )}

              {timeline.map((item) => (
                <div
                  key={item.id}
                  className={`border-l-4 pl-4 ${
                    item.color === "blue"
                      ? "border-blue-500"
                      : item.color === "green"
                      ? "border-green-500"
                      : "border-orange-500"
                  }`}
                >
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-slate-500">{item.description}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {new Date(item.created_at).toLocaleString("en-ZA")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>

            <div className="mt-5 space-y-3">
             <button
  onClick={() => {
    if (!profile?.id) return;

    setTaskAssignedUserId(
      canChooseTaskAssignee
        ? lead.assigned_user_id || profile.id
        : profile.id
    );

    setShowTaskModal(true);
  }}
  className="w-full rounded-lg px-4 py-3 text-white transition"
  style={{ backgroundColor: "var(--brand-primary)" }}
>
  Add Follow-Up Task
</button>

              <button
                onClick={() => openCommunicationModal("WhatsApp", "follow_up")}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-500"
              >
                Send WhatsApp Assist
              </button>

              <button
                onClick={() => openCommunicationModal("Email", "follow_up")}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-500"
              >
                Send Email Assist
              </button>

              <WriteAccessGuard>
  <button
    type="button"
    onClick={startCustomerCall}
    className="w-full rounded-lg brand-accent-bg px-4 py-3 text-white"
  >
    Call and Track Outcome
  </button>
</WriteAccessGuard>

              <button
                onClick={() => setShowVehicleLinkModal(true)}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-500"
              >
                {linkedVehicle ? "Change Linked Vehicle" : "Link Vehicle"}
              </button>

              {linkedDealSnapshot ? (
                <>
                  <Link
                    href={`/deals/${linkedDealSnapshot.id}`}
                    className="block w-full rounded-lg bg-slate-900 px-4 py-3 text-center text-white hover:bg-slate-700"
                  >
                    Open Deal #{linkedDealSnapshot.id}
                  </Link>

                  <WriteAccessGuard>
                    <button
                      type="button"
                      onClick={openDealModal}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-700 hover:bg-slate-50"
                    >
                      Update Deal Details
                    </button>
                  </WriteAccessGuard>
                </>
              ) : (
                <WriteAccessGuard>
                  <button
                    type="button"
                    onClick={openDealModal}
                    disabled={loadingLinkedDeal}
                    className="w-full rounded-lg bg-purple-600 px-4 py-3 text-white hover:bg-purple-500 disabled:opacity-60"
                  >
                    {loadingLinkedDeal
                      ? "Checking Deal..."
                      : "Create Deal"}
                  </button>
                </WriteAccessGuard>
              )}

              {financeApplicationId ? (
                profile?.role === "Sales" ? null : (
                  <Link
                    href={`/finance/${financeApplicationId}`}
                    className="block w-full rounded-lg brand-primary-bg px-4 py-3 text-center text-white"
                  >
                    Open Finance Application
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => void submitToFinance()}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-500"
                >
                  Submit to Finance
                </button>
              )}
            </div>
          </div>

          {linkedDealSnapshot && (
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Delivery Checklist
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Delivery readiness for Deal #{linkedDealSnapshot.id}.
                  </p>
                </div>

                <Link
                  href={`/deals/${linkedDealSnapshot.id}`}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open Full Checklist
                </Link>
              </div>

              {loadingDealChecklist ? (
                <p className="mt-5 text-sm text-slate-500">
                  Loading delivery checklist...
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Progress
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {checklistProgress}%
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Completed
                      </p>
                      <p className="mt-1 text-2xl font-bold text-green-700">
                        {completedChecklistItems} / {dealChecklistItems.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Readiness
                      </p>
                      <p className={`mt-1 text-lg font-bold ${
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

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>

                  {dealChecklistItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Checklist not started
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Open the Deal to initialise and manage the delivery checklist.
                      </p>
                    </div>
                  ) : outstandingChecklistItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold text-green-800">
                        All checklist items are complete.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-700">
                        Outstanding items
                      </p>
                      <div className="mt-2 space-y-2">
                        {outstandingChecklistItems
                          .slice(0, 5)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 px-3 py-2"
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

                      {outstandingChecklistItems.length > 5 && (
                        <p className="mt-2 text-xs text-slate-500">
                          +{outstandingChecklistItems.length - 5} more outstanding item(s)
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {financeApplicationId && (
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Bank Finance Options
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review the latest responses captured by Finance before contacting the customer.
                  </p>
                </div>

                {profile?.role !== "Sales" && (
                  <Link
                    href={`/finance/${financeApplicationId}`}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Open Finance
                  </Link>
                )}
              </div>

              {loadingFinanceBankOffers ? (
                <p className="mt-5 text-sm text-slate-500">Loading bank responses...</p>
              ) : financeBankOffers.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="font-semibold text-slate-700">No bank responses yet</p>
                  <p className="mt-1 text-sm text-slate-500">Finance has not captured a bank decision for this application.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {financeBankOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className={`rounded-xl border p-4 ${
                        offer.is_selected
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                          : offer.status === "Approved"
                          ? "border-green-200 bg-green-50"
                          : offer.status === "Declined"
                          ? "border-red-200 bg-red-50"
                          : "border-orange-200 bg-orange-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{offer.bank_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Response {new Date(offer.response_date).toLocaleString("en-ZA")}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {offer.is_selected && (
                            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                              Customer Selected
                            </span>
                          )}
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          offer.status === "Approved"
                            ? "bg-green-100 text-green-700"
                            : offer.status === "Declined"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}>
                            {offer.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approved Amount</p>
                          <p className="mt-1 font-bold text-slate-900">{formatRand(offer.approved_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly Instalment</p>
                          <p className="mt-1 font-bold text-slate-900">
                            {offer.monthly_installment !== null
                              ? `${formatRand(offer.monthly_installment)} / month`
                              : "Not captured"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rate / Term</p>
                          <p className="mt-1 font-bold text-slate-900">
                            {offer.interest_rate !== null ? `${offer.interest_rate}%` : "-"}
                            {offer.term_months ? ` • ${offer.term_months} months` : ""}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deposit / Balloon</p>
                          <p className="mt-1 font-bold text-slate-900">
                            {formatRand(offer.deposit_amount)}
                            {offer.balloon_percentage !== null ? ` • ${offer.balloon_percentage}% balloon` : ""}
                          </p>
                        </div>
                      </div>

                      {offer.status === "Approved" && !offer.is_selected && (
                        <button
                          type="button"
                          onClick={() => void selectFinanceOfferForCustomer(offer)}
                          disabled={selectingFinanceOfferId === offer.id}
                          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {selectingFinanceOfferId === offer.id
                            ? "Selecting..."
                            : "Customer Selected This Offer"}
                        </button>
                      )}

                      {offer.conditions && (
                        <p className="mt-3 text-sm text-slate-700">
                          <strong>Conditions:</strong> {offer.conditions}
                        </p>
                      )}

                      {offer.approval_expiry_date && (
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Approval expires {new Date(`${offer.approval_expiry_date}T00:00:00`).toLocaleDateString("en-ZA")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl bg-white p-6 shadow">
  
  <div className="rounded-xl bg-white p-6 shadow">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-xl font-bold text-slate-800">
        Matching Inventory
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Available vehicles matched to the calculated affordability
      </p>
    </div>

    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
      {vehicleMatches.length} match
      {vehicleMatches.length === 1 ? "" : "es"}
    </span>
  </div>

  <div className="mt-4 rounded-xl bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      Calculated Maximum Price
    </p>

    <p className="mt-1 text-2xl font-bold text-slate-900">
      {formatRand(maximumAffordableVehiclePrice)}
    </p>

    <p className="mt-1 text-sm text-slate-500">
      Based on a target instalment of{" "}
      {formatRand(targetInstallmentNumber)}/month
    </p>
  </div>

  {vehicleMatches.length === 0 ? (
    <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="font-semibold text-slate-700">
        No available vehicles found within the matching range.
      </p>

      <p className="mt-2 text-sm text-slate-500">
        Try increasing the target instalment, deposit, term or balloon
        percentage.
      </p>

      <Link
        href="/inventory"
        className="mt-4 inline-flex rounded-lg brand-primary-bg px-4 py-2 text-sm font-semibold text-white"
      >
        Open Inventory
      </Link>
    </div>
  ) : (
    <div className="mt-6 space-y-6">
      {[
        {
          title: "Best Matches",
          description:
            "Vehicles closest to the customer’s maximum affordable price.",
          matches: bestMatches,
        },
        {
          title: "Value Options",
          description:
            "Lower-priced vehicles that leave additional room in the budget.",
          matches: valueOptions,
        },
        {
          title: "Slightly Above Budget",
          description:
            "Vehicles up to 10% above the calculated maximum price.",
          matches: slightlyAboveBudget,
        },
      ].map((section) => {
        if (section.matches.length === 0) return null;

        return (
          <div key={section.title}>
            <div>
              <h3 className="font-bold text-slate-800">
                {section.title}
              </h3>

              <p className="text-sm text-slate-500">
                {section.description}
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {section.matches.slice(0, 5).map((match) => {
                const vehicle = match.vehicle;

                return (
                  <div
                    key={vehicle.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                        {vehicle.image_url ? (
                          <img
                            src={vehicle.image_url}
                            alt={formatVehicleTitle(vehicle)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">🚗</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-900">
                              {formatVehicleTitle(vehicle)}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Stock: {vehicle.stock_code || "-"} •{" "}
                              {vehicle.mileage
                                ? `${vehicle.mileage.toLocaleString(
                                    "en-ZA"
                                  )} km`
                                : "Mileage unavailable"}
                            </p>
                          </div>

                          <span
                            className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${
                              match.category === "Best Match"
                                ? "bg-green-100 text-green-700"
                                : match.category === "Value Option"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {match.category}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-400">
                              Vehicle Price
                            </p>

                            <p className="font-semibold text-slate-800">
                              {formatRand(vehicle.price)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-400">
                              Estimated Instalment
                            </p>

                            <p className="font-semibold text-slate-800">
                              {formatRand(
                                match.estimatedInstallment
                              )}
                              /month
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          {match.priceDifference >= 0
                            ? `${formatRand(
                                match.priceDifference
                              )} below maximum budget`
                            : `${formatRand(
                                Math.abs(match.priceDifference)
                              )} above maximum budget`}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/inventory/${vehicle.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View Vehicle
                          </Link>

                          <WriteAccessGuard>
                            <button
                              type="button"
                              disabled={linkingVehicle}
                              onClick={() =>
                                linkInventoryVehicleById(vehicle.id)
                              }
                              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                            >
                              {linkingVehicle
                                ? "Linking..."
                                : "Link to Lead"}
                            </button>
                          </WriteAccessGuard>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
  
  <div>
    <h2 className="text-xl font-bold text-slate-800">
      Affordability Calculator
    </h2>

    <p className="text-sm text-slate-500">
      Calculate the customer&apos;s maximum affordable vehicle price
    </p>
  </div>

<div className="rounded-xl bg-white p-6 shadow">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-xl font-bold text-slate-800">
        Affordability History
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Previous affordability assessments saved for this lead
      </p>
    </div>

    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
      {affordabilityAssessments.length} assessment
      {affordabilityAssessments.length === 1 ? "" : "s"}
    </span>
  </div>

  <div className="mt-5 space-y-3">
    {loadingAssessments ? (
      <p className="text-sm text-slate-500">
        Loading affordability history...
      </p>
    ) : affordabilityAssessments.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <p className="font-medium text-slate-700">
          No affordability assessments saved yet.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Complete the calculator and save the assessment.
        </p>
      </div>
    ) : (
      affordabilityAssessments.slice(0, 8).map((assessment) => (
        <div
          key={assessment.id}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Maximum Price:{" "}
                {formatRand(assessment.maximum_vehicle_price)}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Target:{" "}
                {formatRand(
                  assessment.target_monthly_installment
                )}
                /month
              </p>
            </div>

            <p className="text-right text-xs text-slate-400">
              {new Date(assessment.created_at).toLocaleString(
                "en-ZA"
              )}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">
                Deposit
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {formatRand(assessment.deposit_amount)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Interest Rate
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {assessment.interest_rate}%
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Term
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {assessment.term_months} months
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Balloon
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {assessment.balloon_percentage}%
              </p>
            </div>
          </div>

          {assessment.selected_vehicle_price !== null && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                Selected Vehicle
              </p>

              <p className="mt-1 text-sm font-semibold text-blue-800">
                Price:{" "}
                {formatRand(assessment.selected_vehicle_price)}
              </p>

              {assessment.estimated_installment !== null && (
                <p className="mt-1 text-sm text-blue-700">
                  Estimated instalment:{" "}
                  {formatRand(
                    assessment.estimated_installment
                  )}
                  /month
                </p>
              )}
            </div>
          )}

          {assessment.notes && (
            <p className="mt-4 text-sm text-slate-600">
              {assessment.notes}
            </p>
          )}

          <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400">
            Saved by{" "}
            {assessment.created_by_name || "Unknown User"}
          </p>
        </div>
      ))
    )}
  </div>
</div>

  <div className="mt-5 space-y-4">
    <div>
      <label className="text-sm font-medium text-slate-600">
        Target Monthly Instalment
      </label>

      <input
        type="number"
        min="0"
        step="100"
        value={targetMonthlyInstallment}
        onChange={(e) =>
          setTargetMonthlyInstallment(e.target.value)
        }
        className="mt-1 w-full rounded-lg border border-slate-300 p-3"
      />
    </div>

    <div>
      <label className="text-sm font-medium text-slate-600">
        Deposit
      </label>

      <input
        type="number"
        min="0"
        step="1000"
        value={deposit}
        onChange={(e) => setDeposit(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 p-3"
      />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-600">
          Interest Rate %
        </label>

        <input
          type="number"
          min="0"
          step="0.1"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-600">
          Term Months
        </label>

        <select
          value={termMonths}
          onChange={(e) => setTermMonths(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3"
        >
          <option value="12">12 months</option>
          <option value="24">24 months</option>
          <option value="36">36 months</option>
          <option value="48">48 months</option>
          <option value="60">60 months</option>
          <option value="72">72 months</option>
          <option value="84">84 months</option>
        </select>
      </div>
    </div>

    <div>
      <label className="text-sm font-medium text-slate-600">
        Balloon / Residual %
      </label>

      <select
        value={balloonPercentage}
        onChange={(e) => setBalloonPercentage(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 p-3"
      >
        <option value="0">No balloon</option>
        <option value="10">10%</option>
        <option value="20">20%</option>
        <option value="30">30%</option>
        <option value="35">35%</option>
        <option value="40">40%</option>
      </select>

      <p className="mt-1 text-xs text-slate-400">
        A balloon lowers the monthly instalment but leaves a final amount
        payable at the end of the agreement.
      </p>
    </div>
  </div>

  <div className="mt-6 rounded-xl brand-primary-bg p-5 text-white">
    <p className="text-sm text-slate-300">
      Maximum Affordable Vehicle Price
    </p>

    <p className="mt-2 text-3xl font-bold">
      R
      {maximumAffordableVehiclePrice.toLocaleString("en-ZA", {
        maximumFractionDigits: 0,
      })}
    </p>

    <div className="mt-4 grid gap-2 text-sm text-slate-200">
      <p>
        Target instalment: R
        {targetInstallmentNumber.toLocaleString("en-ZA", {
          maximumFractionDigits: 0,
        })}
        /month
      </p>

      <p>
        Deposit: R
        {depositNumber.toLocaleString("en-ZA", {
          maximumFractionDigits: 0,
        })}
      </p>

      <p>
        Term: {termNumber} months • Balloon: {balloonNumber}%
      </p>
    </div>
  </div>

  {priceNumber > 0 && (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        linkedVehicleIsAffordable
          ? "border-green-200 bg-green-50"
          : "border-orange-200 bg-orange-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold ${
              linkedVehicleIsAffordable
                ? "text-green-700"
                : "text-orange-700"
            }`}
          >
            {linkedVehicle
              ? formatVehicleTitle(linkedVehicle)
              : "Current vehicle price"}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Vehicle price: {formatRand(priceNumber)}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            linkedVehicleIsAffordable
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {linkedVehicleIsAffordable
            ? "Within Budget"
            : "Above Budget"}
        </span>
      </div>

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        <p>
          Estimated instalment: R
          {estimatedInstallment.toLocaleString("en-ZA", {
            maximumFractionDigits: 0,
          })}
          /month
        </p>

        <p>
          Balloon amount: R
          {balloonAmount.toLocaleString("en-ZA", {
            maximumFractionDigits: 0,
          })}
        </p>

        <p>
          {linkedVehicleIsAffordable
            ? `Budget remaining: ${formatRand(
                Math.max(affordabilityDifference, 0)
              )}`
            : `Above calculated budget by: ${formatRand(
                Math.abs(affordabilityDifference)
              )}`}
        </p>
      </div>
    </div>
  )}

  <div className="mt-4">
  <label className="text-sm font-medium text-slate-600">
    Assessment Notes
  </label>

  <textarea
    value={assessmentNotes}
    onChange={(e) => setAssessmentNotes(e.target.value)}
    placeholder="Add affordability notes, customer preferences or conditions..."
    className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3"
  />
</div>

<WriteAccessGuard>
  <button
    type="button"
    onClick={saveAffordabilityAssessment}
    disabled={savingAssessment}
    className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {savingAssessment
      ? "Saving Assessment..."
      : "Save Affordability Assessment"}
  </button>
</WriteAccessGuard>
</div>

<div className="rounded-xl bg-white p-6 shadow">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-xl font-bold text-slate-800">
        Call History
      </h2>

      <p className="text-sm text-slate-500">
        Structured call outcomes recorded for this lead
      </p>
    </div>

    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
      {callLogs.length} call{callLogs.length === 1 ? "" : "s"}
    </span>
  </div>

  <div className="mt-5 space-y-3">
    {loadingCallLogs ? (
      <p className="text-sm text-slate-500">
        Loading call history...
      </p>
    ) : callLogs.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <p className="font-medium text-slate-700">
          No calls logged yet.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Click the customer phone number or use Log Call Attempt.
        </p>
      </div>
    ) : (
      callLogs.slice(0, 8).map((call) => (
        <div
          key={call.id}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  call.outcome === "Answered"
                    ? "bg-green-100 text-green-700"
                    : call.outcome === "Wrong Number"
                    ? "bg-red-100 text-red-700"
                    : call.outcome === "Call Back Later"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {call.outcome}
              </span>

              <p className="mt-2 text-sm font-medium text-slate-800">
                {call.direction} call
                {call.phone_number ? ` • ${call.phone_number}` : ""}
              </p>
            </div>

            <p className="text-right text-xs text-slate-400">
              {new Date(call.called_at).toLocaleString("en-ZA")}
            </p>
          </div>

          {call.notes && (
            <p className="mt-3 text-sm text-slate-600">
              {call.notes}
            </p>
          )}

          <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
            Logged by {call.user_name || "Unknown User"}
          </div>

          {call.follow_up_required && call.follow_up_date && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
              Callback scheduled for{" "}
              {new Date(call.follow_up_date).toLocaleString("en-ZA")}
            </div>
          )}
        </div>
      ))
    )}
  </div>
</div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Lead Documents
                </h2>
                <p className="text-sm text-slate-500">
                  Upload and manage documents linked to this lead
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {documents.length} file{documents.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-slate-800"
                >
                  <option>ID Copy</option>
                  <option>Proof of Address</option>
                  <option>Bank Statement</option>
                  <option>Payslip</option>
                  <option>Driver License</option>
                  <option>Settlement Letter</option>
                  <option>Finance Application</option>
                  <option>Signed Offer</option>
                  <option>Other</option>
                </select>
              </div>

              <label className="block w-full cursor-pointer rounded-lg brand-primary-bg px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90">
                {uploadingDocument
                  ? "Uploading Document..."
                  : "Upload Document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingDocument}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];

                    if (file) {
                      await uploadDocument(file);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <p className="font-medium text-slate-700">
                    No documents uploaded yet.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Upload ID copies, payslips, bank statements and other
                    finance documents here.
                  </p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {doc.document_type || "Document"}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {getFileNameFromUrl(doc.file_url)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Uploaded by {doc.uploaded_by || "Unknown"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doc.created_at
                            ? new Date(doc.created_at).toLocaleString("en-ZA")
                            : ""}
                        </p>
                      </div>
                    </div>

                   <div className="mt-4 grid grid-cols-2 gap-3">
  <button
    type="button"
    onClick={() =>
      void openSecureDocument(
        doc.id,
        "view"
      )
    }
    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
  >
    View
  </button>

  <button
    type="button"
    onClick={() =>
      void openSecureDocument(
        doc.id,
        "download"
      )
    }
    className="rounded-lg brand-primary-bg px-3 py-2 text-center text-sm font-medium text-white"
  >
    Download
  </button>
</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            id="whatsapp"
            ref={whatsappSectionRef}
            className="rounded-xl bg-white p-6 shadow"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  WhatsApp API Dev Inbox
                </h2>
                <p className="text-sm text-slate-500">
                  Legacy development inbox. Use Communication Assist above for MVP1 testing and tracking.
                </p>
              </div>

              <a
                href={`https://wa.me/${normalizePhone(lead.phone)}`}
                target="_blank"
                className="rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200"
              >
                Open WhatsApp
              </a>
            </div>

            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-green-50 p-4">
              {whatsappMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  No WhatsApp messages logged yet.
                </p>
              ) : (
                whatsappMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_type === "customer"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow ${
                        msg.sender_type === "customer"
                          ? "bg-white text-slate-800"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p
                        className={`mt-1 text-right text-xs ${
                          msg.sender_type === "customer"
                            ? "text-slate-400"
                            : "text-green-100"
                        }`}
                      >
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleString("en-ZA")
                          : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <textarea
                ref={whatsappInputRef}
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                placeholder="Type WhatsApp message..."
                className="min-h-20 flex-1 rounded-xl border border-slate-300 p-3 text-sm"
              />

              <button
                onClick={sendWhatsappMessage}
                disabled={sendingWhatsapp}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {sendingWhatsapp ? "Sending..." : "Send"}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Note: free-text WhatsApp messages require the customer to have
              messaged the business number within the 24-hour window. Use Meta
              templates for first contact.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                Follow-Up Tasks
              </h2>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {leadTasks.length} task{leadTasks.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {leadTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    No follow-up tasks yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Use “Add Follow-Up Task” to create the next action for this
                    lead.
                  </p>
                </div>
              ) : (
                leadTasks.map((task) => {
                  const isOverdue =
                    task.due_date &&
                    task.status !== "Completed" &&
                    new Date(task.due_date) < new Date();

                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border p-4 ${
                        isOverdue
                          ? "border-red-200 bg-red-50"
                          : task.status === "Completed"
                          ? "border-green-200 bg-green-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">
                            {task.title}
                          </p>

                          {task.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}

                          {task.due_date && (
                            <p className="mt-2 text-xs text-slate-500">
                              Due:{" "}
                              {new Date(task.due_date).toLocaleString("en-ZA")}
                            </p>
                          )}

                          {task.assigned_user_name && (
                            <p className="mt-1 text-xs text-slate-400">
                              Assigned to: {task.assigned_user_name}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              task.status === "Completed"
                                ? "bg-green-100 text-green-700"
                                : isOverdue
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {task.status || "Open"}
                          </span>

                          {task.priority && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {task.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {linkedDealSnapshot
                    ? `Update Deal #${linkedDealSnapshot.id}`
                    : "Create Draft Deal"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Capture the commercial deal values for this customer.
                  The latest assessment and linked vehicle are used as defaults.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDealModal(false)}
                disabled={savingDeal}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Customer
                  </p>
                  <p className="mt-1 font-bold text-slate-900">
                    {lead.customer}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Vehicle
                  </p>
                  <p className="mt-1 font-bold text-slate-900">
                    {linkedVehicle
                      ? formatVehicleTitle(linkedVehicle)
                      : lead.vehicle || "No vehicle selected"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Sale Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealSalePrice}
                  onChange={(event) =>
                    setDealSalePrice(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Deposit
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealDeposit}
                  onChange={(event) =>
                    setDealDeposit(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Trade-In Value
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealTradeIn}
                  onChange={(event) =>
                    setDealTradeIn(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Settlement Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealSettlement}
                  onChange={(event) =>
                    setDealSettlement(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Extras
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealExtras}
                  onChange={(event) =>
                    setDealExtras(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Discount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealDiscount}
                  onChange={(event) =>
                    setDealDiscount(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">
                  Deal Notes
                </label>
                <textarea
                  value={dealNotes}
                  onChange={(event) =>
                    setDealNotes(event.target.value)
                  }
                  placeholder="Customer conditions, offer details, trade-in notes or special requirements..."
                  className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3"
                />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                Estimated finance amount
              </p>
              <p className="mt-1 text-xl font-bold text-blue-700">
                {formatRand(
                  Math.max(
                    (Number(dealSalePrice) || 0) +
                      (Number(dealExtras) || 0) -
                      (Number(dealDiscount) || 0) -
                      (Number(dealTradeIn) || 0) +
                      (Number(dealSettlement) || 0) -
                      (Number(dealDeposit) || 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDealModal(false)}
                disabled={savingDeal}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void saveDealFromLead()}
                disabled={savingDeal}
                className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
              >
                {savingDeal
                  ? "Saving Deal..."
                  : linkedDealSnapshot
                  ? "Update Deal"
                  : "Create Draft Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVehicleLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Link Vehicle from Inventory
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select the stock unit this customer is interested in.
                </p>
              </div>

              <button
                onClick={() => setShowVehicleLinkModal(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-600">
                Inventory Vehicle
              </label>
              <select
                value={selectedInventoryVehicleId}
                onChange={(e) =>
                  setSelectedInventoryVehicleId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              >
                <option value="">Select vehicle...</option>
                {inventoryVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.stock_code ? `${vehicle.stock_code} • ` : ""}
                    {formatVehicleTitle(vehicle)} • {formatRand(vehicle.price)} •{" "}
                    {vehicle.status || "Available"}
                    {vehicle.linked_lead_id
                      ? ` • Linked to Lead #${vehicle.linked_lead_id}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
              {inventoryVehicles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
                  No inventory vehicles found. Add vehicles from the Inventory
                  page first.
                </div>
              ) : (
                inventoryVehicles.slice(0, 8).map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedInventoryVehicleId(vehicle.id)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:bg-white ${
                      selectedInventoryVehicleId === vehicle.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-800">
                          {formatVehicleTitle(vehicle)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Stock: {vehicle.stock_code || "-"} • Mileage:{" "}
                          {vehicle.mileage
                            ? `${vehicle.mileage.toLocaleString("en-ZA")} km`
                            : "-"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {formatRand(vehicle.price)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${vehicleStatusBadge(
                            vehicle.status
                          )}`}
                        >
                          {vehicle.status || "Available"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowVehicleLinkModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <Link
                href="/inventory"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Inventory
              </Link>

              <button
                onClick={linkInventoryVehicleToLead}
                disabled={linkingVehicle}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {linkingVehicle ? "Linking..." : "Link Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}


      {showCommunicationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {communicationChannel} Assist
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Prepare the message in DealFlow, open the external app, then confirm the outcome.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (savingCommunication) return;
                  setShowCommunicationModal(false);
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Channel
                </label>
                <select
                  value={communicationChannel}
                  onChange={(event) => {
                    const channel = event.target.value as "WhatsApp" | "Email";
                    setCommunicationChannel(channel);

                    if (lead) {
                      const selectedOffer =
                        financeBankOffers.find((offer) => offer.is_selected) ||
                        financeBankOffers.find((offer) => offer.status === "Approved") ||
                        null;

                      const template = buildCommunicationTemplate({
                        templateKey: communicationTemplateKey,
                        channel,
                        lead,
                        vehicleTitle: linkedVehicleTitle,
                        deal: linkedDealSnapshot,
                        financeOffer: selectedOffer,
                        salespersonName:
                          profile?.full_name ||
                          profile?.email ||
                          lead.assigned_user_name ||
                          "Sales",
                      });

                      setCommunicationSubject(template.subject);
                      setCommunicationMessage(template.body);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option>WhatsApp</option>
                  <option>Email</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Template
                </label>
                <select
                  value={communicationTemplateKey}
                  onChange={(event) =>
                    handleCommunicationTemplateChange(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  {COMMUNICATION_TEMPLATES.map((template) => (
                    <option
                      key={template.key}
                      value={template.key}
                    >
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {communicationChannel === "Email" && (
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-600">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={communicationSubject}
                  onChange={(event) => setCommunicationSubject(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-600">
                Message
              </label>
              <textarea
                value={communicationMessage}
                onChange={(event) => setCommunicationMessage(event.target.value)}
                rows={8}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              DealFlow will create a <strong>Pending Outcome</strong> record before opening{" "}
              {communicationChannel}. If the user does not confirm what happened, it remains visible for follow-up and manager accountability.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={savingCommunication}
                onClick={() => setShowCommunicationModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingCommunication}
                onClick={startCommunicationAction}
                className="rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {savingCommunication
                  ? "Starting..."
                  : communicationChannel === "WhatsApp"
                  ? "Open WhatsApp and Track"
                  : "Open Email and Track"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommunicationOutcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeCommunicationLog
                    ? "Resolve Communication Outcome"
                    : "Log Reply / Outcome"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {lead.customer} • {activeCommunicationLog?.channel || communicationChannel}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (savingCommunication) return;
                  setShowCommunicationOutcomeModal(false);
                  setActiveCommunicationLog(null);
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {activeCommunicationLog?.channel === "WhatsApp" && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-semibold">WhatsApp app opened?</p>
                <p className="mt-1">
                  DealFlow tried to open the WhatsApp desktop/mobile app directly. If the app did not open,
                  use the fallback below.
                </p>
                <a
                  href={`https://web.whatsapp.com/send?phone=${normalizePhone(activeCommunicationLog.customer_phone || lead.phone)}&text=${encodeURIComponent(activeCommunicationLog.message_body || "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  Open WhatsApp Web fallback
                </a>
              </div>
            )}

            {activeCommunicationLog?.channel === "Email" && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-semibold">Email app opened?</p>
                <p className="mt-1">
                  DealFlow tried to open your default email app directly. If it did not open,
                  use the fallback below.
                </p>
                <a
                  href={`mailto:${encodeURIComponent(activeCommunicationLog.customer_email || lead.email || "")}?subject=${encodeURIComponent(activeCommunicationLog.subject || "DealFlow message")}&body=${encodeURIComponent(activeCommunicationLog.message_body || "")}`}
                  className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  Open Email fallback
                </a>
              </div>
            )}

            {!activeCommunicationLog && (
              <div className="mt-5">
                <label className="text-sm font-medium text-slate-600">
                  Channel
                </label>
                <select
                  value={communicationChannel}
                  onChange={(event) =>
                    setCommunicationChannel(
                      event.target.value as "WhatsApp" | "Email"
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option>WhatsApp</option>
                  <option>Email</option>
                </select>
              </div>
            )}

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-600">
                Outcome
              </label>
              <select
                value={communicationOutcome}
                onChange={(event) => setCommunicationOutcome(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              >
                {activeCommunicationLog && (
                  <option value="Not Sent">Not Sent</option>
                )}

                {COMMUNICATION_OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>

            {!activeCommunicationLog && (
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-600">
                  Message / Reply Details
                </label>
                <textarea
                  value={communicationMessage}
                  onChange={(event) => setCommunicationMessage(event.target.value)}
                  placeholder="Paste or summarise the customer reply if useful..."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-600">
                Summary / Notes
              </label>
              <textarea
                value={communicationSummary}
                onChange={(event) => setCommunicationSummary(event.target.value)}
                placeholder="What happened and what must happen next?"
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            {activeCommunicationLog && (
              <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={communicationFollowUpRequired}
                  onChange={(event) =>
                    setCommunicationFollowUpRequired(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  Create follow-up task
                </span>
              </label>
            )}

            {activeCommunicationLog && communicationFollowUpRequired && (
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-600">
                  Follow-up date and time
                </label>
                <input
                  type="datetime-local"
                  value={communicationFollowUpDate}
                  onChange={(event) =>
                    setCommunicationFollowUpDate(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={savingCommunication}
                onClick={() => {
                  setShowCommunicationOutcomeModal(false);
                  setActiveCommunicationLog(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingCommunication}
                onClick={
                  activeCommunicationLog
                    ? resolveCommunicationOutcome
                    : saveManualCommunicationLog
                }
                className="rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {savingCommunication ? "Saving..." : "Save Outcome"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCallModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Call Outcome
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {lead.customer} • {lead.phone || "No phone number"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (savingCall) return;

            setShowCallModal(false);
            setCallOutcome("");
            setCallNotes("");
            setCallFollowUpDate("");
          }}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
        >
          ✕
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {[
          "Answered",
          "No Answer",
          "Busy",
          "Voicemail",
          "Wrong Number",
          "Call Back Later",
        ].map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => {
              setCallOutcome(option);

              if (option !== "Call Back Later") {
                setCallFollowUpDate("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-left ${
              callOutcome === option
                ? "border-blue-500 bg-blue-100 text-blue-800"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {callOutcome === "Call Back Later" && (
        <div className="mt-5">
          <label className="text-sm font-medium text-slate-600">
            Callback date and time
          </label>

          <input
            type="datetime-local"
            value={callFollowUpDate}
            onChange={(e) => setCallFollowUpDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 p-3"
          />

          <p className="mt-2 text-xs text-slate-500">
            A linked follow-up task will be created automatically.
          </p>
        </div>
      )}

      <textarea
        value={callNotes}
        onChange={(e) => setCallNotes(e.target.value)}
        placeholder="Add call notes..."
        className="mt-5 w-full rounded-lg border border-slate-300 p-3"
        rows={4}
      />

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          disabled={savingCall}
          onClick={() => {
            setShowCallModal(false);
            setCallOutcome("");
            setCallNotes("");
            setCallFollowUpDate("");
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={saveCallLog}
          disabled={savingCall}
          className="rounded-lg brand-accent-bg px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingCall ? "Saving..." : "Save Call Log"}
        </button>
      </div>
    </div>
  </div>
)}

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Create Follow-Up Task
            </h2>

            <p className="mt-1 text-slate-500">
              Create a callback, reminder or next action for this lead.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Task Title
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Call customer about finance docs"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Additional task notes..."
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Due Date / Time
                </label>
                <input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>

              <div>
  <label className="text-sm font-medium text-slate-600">
    Assign To
  </label>

  {canChooseTaskAssignee ? (
    <select
      value={taskAssignedUserId}
      onChange={(event) =>
        setTaskAssignedUserId(
          event.target.value === ""
            ? ""
            : Number(event.target.value)
        )
      }
      className="mt-1 w-full rounded-lg border border-slate-300 p-3"
    >
      <option value="">
        Select active user...
      </option>

      {salesUsers.map((user) => (
        <option
          key={user.id}
          value={user.id}
        >
          {user.full_name ||
            user.email ||
            `User ${user.id}`}{" "}
          ({user.role || "User"})
        </option>
      ))}
    </select>
  ) : (
    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-100 p-3">
      <p className="font-medium text-slate-800">
        {profile?.full_name ||
          profile?.email ||
          "Current User"}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Tasks you create are automatically assigned
        to you.
      </p>
    </div>
  )}
</div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={createTask}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}
          </PageAccessGuard>

    </DashboardLayout>
  );
}
