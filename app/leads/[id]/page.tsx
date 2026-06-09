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
    "In Prep": "bg-blue-100 text-blue-700",
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

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = Number(params.id);
  const { profile } = useAuth();

  const whatsappSectionRef = useRef<HTMLDivElement | null>(null);
  const whatsappInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [leadTasks, setLeadTasks] = useState<LeadTask[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<number | "">("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [financeApplicationId, setFinanceApplicationId] = useState<
    number | null
  >(null);
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

function startCustomerCall() {
  if (!lead?.phone) {
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
  setShowCallModal(true);

  // Give React a moment to display the modal before opening the dialler.
  setTimeout(() => {
    window.location.href = `tel:+${normalizedPhone}`;
  }, 100);
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

    if (
      linkedVehicle?.id &&
      linkedVehicle.id !== selectedVehicle.id
    ) {
      const { error: releaseError } = await supabase
        .from("inventory_vehicles")
        .update({
          linked_lead_id: null,
          linked_customer_name: null,
          status:
            linkedVehicle.status === "Reserved"
              ? "Available"
              : linkedVehicle.status || "Available",
        })
        .eq("id", linkedVehicle.id)
        .eq("company_id", profile.company_id);

      if (releaseError) {
        alert(
          "Could not release the previously linked vehicle: " +
            releaseError.message
        );
        return;
      }
    }

    const { error: vehicleError } = await supabase
      .from("inventory_vehicles")
      .update({
        linked_lead_id: lead.id,
        linked_customer_name: lead.customer,
        status:
          selectedVehicle.status === "Available"
            ? "Reserved"
            : selectedVehicle.status || "Reserved",
      })
      .eq("id", selectedVehicle.id)
      .eq("company_id", profile.company_id);

    if (vehicleError) {
      alert("Error linking vehicle: " + vehicleError.message);
      return;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({
        vehicle: title,
      })
      .eq("id", lead.id)
      .eq("company_id", profile.company_id);

    if (leadError) {
      alert(
        "Vehicle linked, but lead update failed: " +
          leadError.message
      );
      return;
    }

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
      vehicle: title,
    });

    setVehiclePrice(
      selectedVehicle.price
        ? String(selectedVehicle.price)
        : vehiclePrice
    );

    setShowVehicleLinkModal(false);
    setSelectedInventoryVehicleId("");

    await Promise.all([
      fetchLinkedInventoryVehicle(),
      fetchInventoryVehicles(),
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

    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message: messageToSend,
        mode: "text",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(JSON.stringify(result, null, 2));
      setSendingWhatsapp(false);
      return;
    }

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        sender_type: "user",
        sender_name: profile.full_name,
        message: messageToSend,
      })
      .select("*")
      .single();

    if (saveError) {
      alert("Message sent, but failed to save in CRM: " + saveError.message);
    }

    await addActivity("WhatsApp Sent", messageToSend, "whatsapp", "green");

    if (savedMessage) {
      setWhatsappMessages((prev) => [...prev, savedMessage]);
    }

    setWhatsappInput("");
    setSendingWhatsapp(false);
  }

  async function submitToFinance() {
    if (!lead) return;

    const { data: existingApplication, error: checkError } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("lead_id", lead.id)
      .eq("company_id", profile?.company_id)
      .maybeSingle();

    if (checkError) {
      alert("Error checking finance application: " + checkError.message);
      return;
    }

    if (existingApplication) {
      alert("This lead has already been submitted to finance.");
      return;
    }

    const { error: financeError } = await supabase
      .from("finance_applications")
      .insert({
        lead_id: lead.id,
        customer: lead.customer,
        vehicle: lead.vehicle,
        requested_amount: 0,
        deposit: 0,
        monthly_budget: 0,
        finance_status: "Submitted",
        bank: "Pending bank allocation",
        company_id: profile?.company_id,
        finance_notes: "Finance application submitted from lead detail page.",
      });

    if (financeError) {
      alert("Error submitting to finance: " + financeError.message);
      return;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({
        finance: "Submitted",
        status: "Submitted to Finance",
      })
      .eq("id", leadId)
      .eq("company_id", profile?.company_id);

    if (leadError) {
      alert("Finance submitted, but lead update failed: " + leadError.message);
      return;
    }

    await addActivity(
      "Submitted to Finance",
      "Lead was submitted to the finance department for review.",
      "Finance",
      "orange"
    );

    setLead((currentLead) =>
      currentLead
        ? {
            ...currentLead,
            finance: "Submitted",
            status: "Submitted to Finance",
          }
        : currentLead
    );

    setLeadStatus("Submitted to Finance");
    alert("Lead submitted to finance successfully.");

    fetchLead();
    fetchActivities();
    checkFinanceApplication();
  }

  async function createTask() {
    if (!lead || !profile?.company_id) return;

    if (!taskTitle.trim() || !taskDueDate) {
      alert("Please enter a task title and due date.");
      return;
    }

    const selectedUser =
      salesUsers.find((user) => user.id === Number(taskAssignedUserId)) ||
      salesUsers.find((user) => user.id === lead.assigned_user_id);

    const { error } = await supabase.from("tasks").insert({
      company_id: profile.company_id,
      lead_id: lead.id,
      assigned_user_id: selectedUser?.id || profile.id,
      assigned_user_name:
        selectedUser?.full_name || selectedUser?.email || profile.full_name,
      title: taskTitle,
      description: taskDescription,
      task_type: "Follow-up",
      status: "Open",
      priority: taskPriority,
      due_date: taskDueDate,
      created_by_id: profile.id,
      created_by_name: profile.full_name,
    });

    if (error) {
      alert("Error creating task: " + error.message);
      return;
    }

    await addActivity(
      "Task Created",
      `${taskTitle} • Due: ${new Date(taskDueDate).toLocaleString("en-ZA")}`,
      "task",
      "blue"
    );

    setShowTaskModal(false);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskPriority("Medium");
    setTaskAssignedUserId("");
    fetchLeadTasks();

    alert("Task created successfully.");
  }

async function saveCallLog() {
  if (!lead || !profile?.company_id) return;

  if (!callOutcome) {
    alert("Please select a call outcome.");
    return;
  }

  const followUpRequired = callOutcome === "Call Back Later";

  if (followUpRequired && !callFollowUpDate) {
    alert("Please select a callback date and time.");
    return;
  }

  setSavingCall(true);

  try {
    const normalizedPhone = normalizePhone(lead.phone);

    const { data: savedCall, error: callError } = await supabase
      .from("call_logs")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        user_profile_id: profile.id,
        user_name: profile.full_name || profile.email || "Unknown User",
        phone_number: normalizedPhone ? `+${normalizedPhone}` : lead.phone,
        direction: "Outbound",
        outcome: callOutcome,
        notes: callNotes.trim() || null,
        follow_up_required: followUpRequired,
        follow_up_date:
          followUpRequired && callFollowUpDate
            ? new Date(callFollowUpDate).toISOString()
            : null,
      })
      .select("id")
      .single();

    if (callError || !savedCall) {
      alert("Error saving call log: " + (callError?.message || "Unknown error"));
      return;
    }

    let followUpTaskId: number | null = null;

    if (followUpRequired && callFollowUpDate) {
      const assignedUserId = lead.assigned_user_id || profile.id;
      const assignedUserName =
        lead.assigned_user_name ||
        profile.full_name ||
        profile.email ||
        "Unknown User";

      const { data: savedTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          company_id: profile.company_id,
          lead_id: lead.id,
          assigned_user_id: assignedUserId,
          assigned_user_name: assignedUserName,
          title: `Call back ${lead.customer}`,
          description:
            callNotes.trim() ||
            `Callback requested after outbound call to ${lead.customer}.`,
          task_type: "Follow-up",
          status: "Open",
          priority: "High",
          due_date: new Date(callFollowUpDate).toISOString(),
          created_by_id: profile.id,
          created_by_name:
            profile.full_name || profile.email || "Unknown User",
        })
        .select("id")
        .single();

      if (taskError) {
        alert(
          "Call log saved, but callback task could not be created: " +
            taskError.message
        );
      } else if (savedTask) {
        followUpTaskId = savedTask.id;

        const { error: linkError } = await supabase
          .from("call_logs")
          .update({
            follow_up_task_id: followUpTaskId,
          })
          .eq("id", savedCall.id)
          .eq("company_id", profile.company_id);

        if (linkError) {
          console.error(
            "Call saved, but task link could not be updated:",
            linkError.message
          );
        }
      }
    }

    const activityDescription = [
      `Outcome: ${callOutcome}`,
      callNotes.trim() ? `Notes: ${callNotes.trim()}` : null,
      followUpRequired && callFollowUpDate
        ? `Callback: ${new Date(callFollowUpDate).toLocaleString("en-ZA")}`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    await addActivity(
      "Call Logged",
      activityDescription,
      "call",
      callOutcome === "Answered" ? "green" : "orange"
    );

await Promise.all([
  fetchLeadTasks(),
  fetchCallLogs(),
]);

    setShowCallModal(false);
    setCallOutcome("");
    setCallNotes("");
    setCallFollowUpDate("");

    alert(
      followUpTaskId
        ? "Call logged and callback task created successfully."
        : "Call logged successfully."
    );
  } catch (error) {
    console.error("Unexpected call log error:", error);
    alert("Unexpected error saving the call log.");
  } finally {
    setSavingCall(false);
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
  }, [leadId, profile?.company_id]);

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
                <h1 className="text-3xl font-bold text-slate-800">
                  {lead.customer}
                </h1>
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
                  setTaskAssignedUserId(
                    lead.assigned_user_id || profile?.id || ""
                  );
                  setShowTaskModal(true);
                }}
                className="w-full rounded-lg px-4 py-3 text-white transition"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                Add Follow-Up Task
              </button>

              <button
                onClick={() => {
                  whatsappSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });

                  setTimeout(() => {
                    whatsappInputRef.current?.focus();
                  }, 500);
                }}
                className="w-full rounded-lg brand-primary-bg px-4 py-3 text-white"
              >
                Send WhatsApp
              </button>

              <WriteAccessGuard>
  <button
    type="button"
    onClick={() => {
      setCallOutcome("");
      setCallNotes("");
      setCallFollowUpDate("");
      setShowCallModal(true);
    }}
    className="w-full rounded-lg brand-accent-bg px-4 py-3 text-white"
  >
    Log Call Attempt
  </button>
</WriteAccessGuard>

              <button
                onClick={() => setShowVehicleLinkModal(true)}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-500"
              >
                {linkedVehicle ? "Change Linked Vehicle" : "Link Vehicle"}
              </button>

              {financeApplicationId ? (
                <a
                  href={`/finance/${financeApplicationId}`}
                  className="block w-full rounded-lg brand-primary-bg px-4 py-3 text-center text-white"
                >
                  Open Finance Application
                </a>
              ) : (
                <button
                  onClick={submitToFinance}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-500"
                >
                  Submit to Finance
                </button>
              )}
            </div>
          </div>

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

  <WriteAccessGuard>
    <button
      type="button"
      onClick={() => {
        addActivity(
          "Affordability Calculated",
          [
            `Target instalment: R${targetInstallmentNumber.toLocaleString(
              "en-ZA",
              { maximumFractionDigits: 0 }
            )}/month`,
            `Maximum vehicle price: R${maximumAffordableVehiclePrice.toLocaleString(
              "en-ZA",
              { maximumFractionDigits: 0 }
            )}`,
            `Deposit: R${depositNumber.toLocaleString("en-ZA", {
              maximumFractionDigits: 0,
            })}`,
            `Interest: ${rateNumber}%`,
            `Term: ${termNumber} months`,
            `Balloon: ${balloonNumber}%`,
          ].join(" • "),
          "calculator",
          "orange"
        );
      }}
      className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 text-white hover:bg-orange-400"
    >
      Save Calculation to Timeline
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
                      <a
                        href={doc.file_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        View
                      </a>

                      <a
                        href={doc.file_url || "#"}
                        download
                        className="rounded-lg brand-primary-bg px-3 py-2 text-center text-sm font-medium text-white"
                      >
                        Download
                      </a>
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
                  WhatsApp Conversation
                </h2>
                <p className="text-sm text-slate-500">
                  Send real WhatsApp messages to this customer
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
                <select
                  value={taskAssignedUserId}
                  onChange={(e) =>
                    setTaskAssignedUserId(Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  {salesUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} ({user.role})
                    </option>
                  ))}
                </select>
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
