"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type FinanceDocument = {
  id: number;
  finance_application_id: number;
  lead_id: number | null;
  document_name: string;
  document_type: string | null;
  file_path: string;
  finance_bank_offer_id: number | null;
  uploaded_by: string | null;
  created_at: string;
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
  selected_bank_offer_id: number | null;
};

type FinanceNote = {
  id: number;
  finance_application_id: number;
  lead_id: number | null;
  note: string;
  created_by: string | null;
  created_at: string;
};

type Activity = {
  id: number;
  title: string | null;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string | null;
};

type LeadSummary = {
  id: number;
  customer: string | null;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  budget: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  status: string | null;
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
  company_id: number;
  finance_application_id: number;
  lead_id: number | null;
  deal_id: number | null;
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
  captured_by_id: number | null;
  captured_by_name: string | null;
  response_date: string;
  created_at: string;
  updated_at: string;
  is_selected: boolean;
  selected_at: string | null;
  selected_by_id: number | null;
  selected_by_name: string | null;
};

type LinkedDeal = {
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
};

function formatRand(
  value: number | null | undefined
) {
  if (value === null || value === undefined) {
    return "Not captured";
  }

  return `R ${Number(value).toLocaleString(
    "en-ZA",
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) return "-";

  return new Date(value).toLocaleString(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function calculateNetDealValue(
  deal: LinkedDeal | null
) {
  if (!deal) return 0;

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

  return (
    salePrice +
    extras -
    discount -
    tradeIn +
    settlement
  );
}

export default function FinanceDetailPage() {
  const { profile } = useAuth();
  const params = useParams();
  const financeId = params.id as string;
const [financeDocuments, setFinanceDocuments] = useState<FinanceDocument[]>([]);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [documentType, setDocumentType] = useState("ID Document");
  const [application, setApplication] =
    useState<FinanceApplication | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
const [leadSummary, setLeadSummary] =
  useState<LeadSummary | null>(null);

const [
  latestAssessment,
  setLatestAssessment,
] = useState<AffordabilityAssessment | null>(
  null
);

const [linkedDeal, setLinkedDeal] =
  useState<LinkedDeal | null>(null);

const [showLeadSummaryModal, setShowLeadSummaryModal] =
  useState(false);

const [showCustomerSummaryModal, setShowCustomerSummaryModal] =
  useState(false);

const [showDealSummaryModal, setShowDealSummaryModal] =
  useState(false);

const [loadingFinanceContext, setLoadingFinanceContext] =
  useState(false);
const [financeNotesHistory, setFinanceNotesHistory] = useState<FinanceNote[]>([]);
const [newFinanceNote, setNewFinanceNote] = useState("");
const [bankOffers, setBankOffers] = useState<FinanceBankOffer[]>([]);
const [savingBankOffer, setSavingBankOffer] = useState(false);
const [editingBankOfferId, setEditingBankOfferId] = useState<number | null>(null);
const [bankName, setBankName] = useState("");
const [bankOfferStatus, setBankOfferStatus] = useState<FinanceBankOffer["status"]>("Submitted");
const [approvedAmount, setApprovedAmount] = useState("");
const [offerInterestRate, setOfferInterestRate] = useState("");
const [offerDeposit, setOfferDeposit] = useState("");
const [offerTermMonths, setOfferTermMonths] = useState("");
const [offerBalloon, setOfferBalloon] = useState("");
const [offerMonthlyInstallment, setOfferMonthlyInstallment] = useState("");
const [offerExpiryDate, setOfferExpiryDate] = useState("");
const [offerConditions, setOfferConditions] = useState("");
const [offerNotes, setOfferNotes] = useState("");
const [selectedBankOfferId, setSelectedBankOfferId] = useState<number | "">("");
const [selectingOfferId, setSelectingOfferId] = useState<number | null>(null);

const approvedBankNames = Array.from(
  new Set(
    bankOffers
      .filter((offer) => offer.status === "Approved")
      .map((offer) => offer.bank_name.trim())
      .filter(Boolean)
  )
);

const bankSummary =
  approvedBankNames.length > 0
    ? approvedBankNames.join(", ")
    : bankOffers.some(
        (offer) =>
          offer.status === "Pending" ||
          offer.status === "Submitted"
      )
    ? "Awaiting responses"
    : bankOffers.length > 0
    ? "All banks declined"
    : application?.bank || "Pending bank allocation";

async function fetchFinanceNotes() {
  const { data, error } = await supabase
    .from("finance_notes")
    .select("*")
    .eq("finance_application_id", financeId)
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading finance notes:", error.message);
    setFinanceNotesHistory([]);
    return;
  }

  setFinanceNotesHistory(Array.isArray(data) ? data : []);
}

async function fetchFinanceDocuments() {
  const { data, error } = await supabase
    .from("finance_documents")
    .select("*")
    .eq("finance_application_id", financeId)
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading finance documents:", error.message);
  } else {
    setFinanceDocuments(data || []);
  }
}

async function addFinanceNote() {
  if (!application || !newFinanceNote.trim()) return;

  const { error } = await supabase.from("finance_notes").insert({
    finance_application_id: application.id,
      company_id: profile?.company_id,
    lead_id: application.lead_id,
    note: newFinanceNote,
    created_by: "Finance User",
  });

  if (error) {
    alert("Error saving finance note: " + error.message);
    return;
  }

  if (application.lead_id) {
    await supabase.from("lead_activities").insert({
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      title: "Finance Note Added",
      description: newFinanceNote,
      activity_type: "Finance",
      color: "orange",
    });
  }

  setNewFinanceNote("");
  fetchFinanceNotes();
  fetchFinanceApplication();
}

async function uploadDocument() {
  if (!selectedFile || !application) {
    alert("Please select a file.");
    return;
  }

  if (documentType === "Bank Approval" && selectedBankOfferId === "") {
    alert("Please select the approved bank offer for this document.");
    return;
  }

  const fileExt = selectedFile.name.split(".").pop();

  const fileName = `${Date.now()}.${fileExt}`;

  const filePath = `finance/${application.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("finance-documents")
    .upload(filePath, selectedFile);

  if (uploadError) {
    alert("Upload failed: " + uploadError.message);
    return;
  }

  const { error: dbError } = await supabase
    .from("finance_documents")
    .insert({
      finance_application_id: application.id,
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      document_name: selectedFile.name,
      document_type: documentType,
      finance_bank_offer_id:
        documentType === "Bank Approval" && selectedBankOfferId !== ""
          ? Number(selectedBankOfferId)
          : null,
      file_path: filePath,
      uploaded_by: "Finance User",
    });

  if (dbError) {
    alert("Database save failed: " + dbError.message);
    return;
  }

  if (application.lead_id) {
    await supabase.from("lead_activities").insert({
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      title: "Finance Document Uploaded",
      description: `${documentType}: ${selectedFile.name}`,
      activity_type: "Document",
      color: "blue",
    });
  }

  if (documentType === "Bank Approval") {
    window.dispatchEvent(new CustomEvent("dealflow-task-updated"));
  }

  alert("Document uploaded successfully.");

  setSelectedFile(null);

  fetchFinanceDocuments();
  fetchFinanceApplication();
}

async function fetchLeadSummary(
  leadId: number
) {
  if (!profile?.company_id) return;

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, customer, phone, email, vehicle, budget, assigned_user_id, assigned_user_name, status"
    )
    .eq("id", leadId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (error) {
    console.error(
      "Error loading linked lead summary:",
      error.message
    );

    setLeadSummary(null);
    return;
  }

  setLeadSummary(data || null);
}

async function fetchLatestAssessment(
  leadId: number
) {
  if (!profile?.company_id) return;

  const { data, error } = await supabase
    .from("lead_affordability_assessments")
    .select(
      "id, company_id, lead_id, created_by_id, created_by_name, target_monthly_installment, deposit_amount, interest_rate, term_months, balloon_percentage, maximum_vehicle_price, selected_vehicle_id, selected_vehicle_price, estimated_installment, notes, created_at"
    )
    .eq("company_id", profile.company_id)
    .eq("lead_id", leadId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error loading affordability assessment:",
      error.message
    );

    setLatestAssessment(null);
    return;
  }

  setLatestAssessment(data || null);
}

async function fetchLinkedDeal(
  leadId: number
) {
  if (!profile?.company_id) return;

  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, company_id, lead_id, vehicle_id, customer_name, vehicle_name, deal_stage, finance_status, sale_price, deposit_amount, trade_in_value, settlement_amount, extras_amount, discount_amount, assigned_user_id, notes, created_at, updated_at"
    )
    .eq("company_id", profile.company_id)
    .eq("lead_id", leadId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error loading linked deal:",
      error.message
    );

    setLinkedDeal(null);
    return;
  }

  setLinkedDeal(data || null);
}

async function fetchFinanceContext(
  leadId: number
) {
  setLoadingFinanceContext(true);

  try {
    await Promise.all([
      fetchLeadSummary(leadId),
      fetchLatestAssessment(leadId),
      fetchLinkedDeal(leadId),
    ]);
  } finally {
    setLoadingFinanceContext(false);
  }
}

async function fetchBankOffers() {
  if (!profile?.company_id) return;

  const { data, error } = await supabase
    .from("finance_bank_offers")
    .select("*")
    .eq("company_id", profile.company_id)
    .eq("finance_application_id", financeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading bank offers:", error.message);
    setBankOffers([]);
    return;
  }

  setBankOffers(Array.isArray(data) ? data : []);
}

function resetBankOfferForm() {
  setEditingBankOfferId(null);
  setBankName("");
  setBankOfferStatus("Submitted");
  setApprovedAmount("");
  setOfferInterestRate("");
  setOfferDeposit("");
  setOfferTermMonths("");
  setOfferBalloon("");
  setOfferMonthlyInstallment("");
  setOfferExpiryDate("");
  setOfferConditions("");
  setOfferNotes("");
}

function editBankOffer(offer: FinanceBankOffer) {
  setEditingBankOfferId(offer.id);
  setBankName(offer.bank_name);
  setBankOfferStatus(offer.status);
  setApprovedAmount(offer.approved_amount?.toString() || "");
  setOfferInterestRate(offer.interest_rate?.toString() || "");
  setOfferDeposit(offer.deposit_amount?.toString() || "");
  setOfferTermMonths(offer.term_months?.toString() || "");
  setOfferBalloon(offer.balloon_percentage?.toString() || "");
  setOfferMonthlyInstallment(offer.monthly_installment?.toString() || "");
  setOfferExpiryDate(offer.approval_expiry_date || "");
  setOfferConditions(offer.conditions || "");
  setOfferNotes(offer.notes || "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function selectCustomerOffer(offer: FinanceBankOffer) {
  const confirmed = window.confirm(
    `Confirm that the customer selected the ${offer.bank_name} offer? This moves the Deal and vehicle to Sale Pending.`
  );

  if (!confirmed) return;

  setSelectingOfferId(offer.id);

  const { error } = await supabase.rpc(
    "select_finance_bank_offer",
    { p_offer_id: offer.id }
  );

  setSelectingOfferId(null);

  if (error) {
    alert("Could not select the finance offer: " + error.message);
    return;
  }

  await Promise.all([
    fetchBankOffers(),
    fetchFinanceApplication(),
  ]);

  window.dispatchEvent(new CustomEvent("dealflow-task-updated"));

  alert(`${offer.bank_name} was selected successfully.`);
}

async function saveBankOffer() {
  if (!application || !profile?.company_id || !profile?.id) return;

  if (!bankName.trim()) {
    alert("Please enter the bank or finance provider.");
    return;
  }

  if (bankOfferStatus === "Approved" && !approvedAmount) {
    alert("Please enter the approved amount.");
    return;
  }

  setSavingBankOffer(true);

  const payload = {
    company_id: profile.company_id,
    finance_application_id: application.id,
    lead_id: application.lead_id,
    deal_id: linkedDeal?.id || null,
    bank_name: bankName.trim(),
    status: bankOfferStatus,
    approved_amount: approvedAmount ? Number(approvedAmount) : null,
    interest_rate: offerInterestRate ? Number(offerInterestRate) : null,
    deposit_amount: offerDeposit ? Number(offerDeposit) : null,
    term_months: offerTermMonths ? Number(offerTermMonths) : null,
    balloon_percentage: offerBalloon ? Number(offerBalloon) : null,
    monthly_installment: offerMonthlyInstallment ? Number(offerMonthlyInstallment) : null,
    approval_expiry_date: offerExpiryDate || null,
    conditions: offerConditions.trim() || null,
    notes: offerNotes.trim() || null,
    captured_by_id: profile.id,
    captured_by_name: profile.full_name || profile.email || "Finance User",
    response_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = editingBankOfferId
    ? supabase
        .from("finance_bank_offers")
        .update(payload)
        .eq("id", editingBankOfferId)
        .eq("company_id", profile.company_id)
    : supabase.from("finance_bank_offers").insert(payload);

  const { error } = await query;

  if (error) {
    alert("Error saving bank offer: " + error.message);
    setSavingBankOffer(false);
    return;
  }

  resetBankOfferForm();
  await Promise.all([
    fetchBankOffers(),
    fetchFinanceApplication(),
  ]);

  setSavingBankOffer(false);
  alert("Bank response saved successfully.");
}

  async function fetchFinanceApplication() {
    setLoading(true);

    const { data, error } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("id", financeId)
      .eq("company_id", profile?.company_id)
      .single();

    if (error) {
      console.error("Error loading finance application:", error.message);
      setLoading(false);
      return;
    }

    setApplication(data);

    if (data.lead_id) {
      await fetchFinanceContext(
        Number(data.lead_id)
      );
      const { data: activityData, error: activityError } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", data.lead_id)
      .eq("company_id", profile?.company_id)
      .order("created_at", { ascending: false });

      await fetchFinanceNotes();
      await fetchFinanceDocuments();
      await fetchBankOffers();

      if (activityError) {
        console.error("Error loading activities:", activityError.message);
      } else {
        setActivities(activityData || []);
      }
    }
    else {
  setLeadSummary(null);
  setLatestAssessment(null);
  setLinkedDeal(null);
}

    setLoading(false);
  }

  useEffect(() => {
  if (
    !profile?.company_id ||
    !financeId
  ) {
    return;
  }

  void fetchFinanceApplication();
}, [
  profile?.company_id,
  financeId,
]);

  function statusClass(status: string | null) {
    if (status === "Approved") return "bg-green-100 text-green-700";
    if (status === "Declined") return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  }


  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-slate-500">
          Loading finance application...
        </div>
      </DashboardLayout>
    );
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-slate-600">Finance application not found.</p>
          <Link href="/finance" className="mt-4 inline-block text-blue-700">
            Back to Finance Queue
          </Link>
        </div>
      </DashboardLayout>
    );
  }

if (!canAccessRole(profile?.role, "finance")) {
  return (
    <DashboardLayout>
      <div className="rounded-xl bg-white p-10 shadow">
        <h1 className="text-2xl font-bold text-slate-800">
          Access Denied
        </h1>

        <p className="mt-3 text-slate-500">
          You do not have permission to access Finance.
        </p>
      </div>
    </DashboardLayout>
  );
}

return (
  <DashboardLayout>
    <PageAccessGuard module="finance">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/finance" className="text-sm font-bold text-blue-700 hover:underline">
              ← Back to Finance Queue
            </Link>

            <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-orange-700">
              Finance application
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {application.customer || "Customer"}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {application.vehicle || "Vehicle not captured"} • Application #{application.id}
            </p>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${statusClass(
              application.finance_status
            )}`}
          >
            {application.finance_status || "Submitted"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              Finance Application Summary
            </h2>



            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium text-slate-800">
                  {application.customer}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Vehicle</p>
                <p className="font-medium text-slate-800">
                  {application.vehicle}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Approved Bank Options
                </p>
                <p className="font-medium text-slate-800">
                  {bankSummary}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Requested Amount</p>
                <p className="font-medium text-slate-800">
                  {formatRand(application.requested_amount)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Monthly Budget</p>
                <p className="font-medium text-slate-800">
                  {formatRand(application.monthly_budget)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Deposit</p>
                <p className="font-medium text-slate-800">
                  {formatRand(application.deposit)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Submitted</p>
                <p className="font-medium text-slate-800">
                  {application.submitted_at
                    ? new Date(application.submitted_at).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            </div>
          </div>

<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-800">
        Finance Decision Context
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Review the salesperson, affordability assessment
        and deal information before recording a bank
        decision.
      </p>
    </div>

    {application.lead_id && (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowLeadSummaryModal(true)}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          View Lead Summary
        </button>

        <button
          type="button"
          onClick={() => setShowCustomerSummaryModal(true)}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          View Customer Summary
        </button>

        {linkedDeal && (
          <button
            type="button"
            onClick={() => setShowDealSummaryModal(true)}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            View Deal Summary
          </button>
        )}
      </div>
    )}
  </div>

  {loadingFinanceContext ? (
    <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
      Loading assessment and deal information...
    </div>
  ) : (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Customer and Salesperson
        </h3>

        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceInfo
            label="Customer"
            value={
              leadSummary?.customer ||
              application.customer
            }
          />

          <FinanceInfo
            label="Assigned Salesperson"
            value={
              leadSummary?.assigned_user_name ||
              "Unassigned"
            }
          />

          <FinanceInfo
            label="Phone"
            value={
              leadSummary?.phone ||
              "Not captured"
            }
          />

          <FinanceInfo
            label="Customer Budget"
            value={
              leadSummary?.budget ||
              formatRand(
                application.monthly_budget
              )
            }
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Latest Affordability Assessment
          </h3>

          {latestAssessment && (
            <span className="text-xs font-medium text-slate-400">
              Saved{" "}
              {formatDateTime(
                latestAssessment.created_at
              )}
            </span>
          )}
        </div>

        {!latestAssessment ? (
          <div className="mt-3 rounded-xl border border-dashed border-orange-300 bg-orange-50 p-5">
            <p className="font-semibold text-orange-800">
              No affordability assessment found
            </p>

            <p className="mt-1 text-sm text-orange-700">
              Finance should confirm affordability details
              with the salesperson before approaching banks.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceInfo
                label="Target Instalment"
                value={`${formatRand(
                  latestAssessment.target_monthly_installment
                )} / month`}
              />

              <FinanceInfo
                label="Maximum Vehicle Price"
                value={formatRand(
                  latestAssessment.maximum_vehicle_price
                )}
              />

              <FinanceInfo
                label="Deposit"
                value={formatRand(
                  latestAssessment.deposit_amount
                )}
              />

              <FinanceInfo
                label="Selected Vehicle Price"
                value={formatRand(
                  latestAssessment.selected_vehicle_price
                )}
              />

              <FinanceInfo
                label="Estimated Instalment"
                value={
                  latestAssessment.estimated_installment !==
                  null
                    ? `${formatRand(
                        latestAssessment.estimated_installment
                      )} / month`
                    : "Not calculated"
                }
              />

              <FinanceInfo
                label="Interest Rate"
                value={`${Number(
                  latestAssessment.interest_rate
                )}%`}
              />

              <FinanceInfo
                label="Term"
                value={`${latestAssessment.term_months} months`}
              />

              <FinanceInfo
                label="Balloon"
                value={`${Number(
                  latestAssessment.balloon_percentage
                )}%`}
              />
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Assessment Notes
              </p>

              <p className="mt-2 text-sm text-slate-700">
                {latestAssessment.notes ||
                  "No assessment notes were captured."}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Captured by{" "}
                {latestAssessment.created_by_name ||
                  "Unknown User"}
              </p>
            </div>

            {latestAssessment.selected_vehicle_id && (
              <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                Assessed Vehicle ID #{latestAssessment.selected_vehicle_id}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Linked Deal
        </h3>

        {!linkedDeal ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="font-semibold text-slate-700">
              No linked deal found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              The finance application is linked to the lead,
              but no deal has been created for this lead yet.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-lg font-bold text-green-900">
                  Deal #{linkedDeal.id}
                </p>

                <p className="mt-1 text-sm text-green-800">
                  {linkedDeal.vehicle_name ||
                    application.vehicle ||
                    "No vehicle captured"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDealSummaryModal(true)}
                className="rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-500"
              >
                View Deal Summary
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceInfo
                label="Deal Stage"
                value={
                  linkedDeal.deal_stage ||
                  "Draft"
                }
              />

              <FinanceInfo
                label="Deal Finance Status"
                value={
                  linkedDeal.finance_status ||
                  "Not Started"
                }
              />

              <FinanceInfo
                label="Sale Price"
                value={formatRand(
                  linkedDeal.sale_price
                )}
              />

              <FinanceInfo
                label="Estimated Net Deal"
                value={formatRand(
                  calculateNetDealValue(
                    linkedDeal
                  )
                )}
              />

              <FinanceInfo
                label="Deposit"
                value={formatRand(
                  linkedDeal.deposit_amount
                )}
              />

              <FinanceInfo
                label="Trade-In"
                value={formatRand(
                  linkedDeal.trade_in_value
                )}
              />

              <FinanceInfo
                label="Settlement"
                value={formatRand(
                  linkedDeal.settlement_amount
                )}
              />

              <FinanceInfo
                label="Last Updated"
                value={formatDateTime(
                  linkedDeal.updated_at
                )}
              />
            </div>

            {linkedDeal.notes && (
              <div className="mt-4 rounded-xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Deal Notes
                </p>

                <p className="mt-2 text-sm text-green-900">
                  {linkedDeal.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )}
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-bold text-slate-800">
    Finance Notes History
  </h2>

  <div className="mt-5 space-y-3">
    <textarea
      placeholder="Add a new finance note..."
      value={newFinanceNote}
      onChange={(e) => setNewFinanceNote(e.target.value)}
      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />

    <button
      onClick={addFinanceNote}
      className="rounded-2xl brand-primary-bg px-4 py-2 text-white"
    >
      Add Note
    </button>
  </div>

  <div className="mt-6 space-y-4">
    {financeNotesHistory.length === 0 ? (
      <p className="text-slate-500">No finance notes recorded yet.</p>
    ) : (
      financeNotesHistory.map((note) => (
        <div
          key={note.id}
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-slate-700">{note.note}</p>

          <p className="mt-2 text-xs text-slate-400">
            {note.created_by || "Finance User"} •{" "}
            {new Date(note.created_at).toLocaleString("en-ZA")}
          </p>
        </div>
      ))
    )}
  </div>
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-bold text-slate-800">
    Finance Documents
  </h2>

  <div className="mt-5 space-y-4">
    <select
      value={documentType}
      onChange={(e) => setDocumentType(e.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    >
      <option>ID Document</option>
      <option>Payslip</option>
      <option>Bank Statement</option>
      <option>Proof of Address</option>
      <option>Drivers License</option>
      <option>Bank Approval</option>
      <option>Bank Decline</option>
      <option>Signed Finance Agreement</option>
      <option>Other</option>
    </select>
    {documentType === "Bank Approval" && (
      <select
        value={selectedBankOfferId}
        onChange={(event) =>
          setSelectedBankOfferId(
            event.target.value === "" ? "" : Number(event.target.value)
          )
        }
        className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <option value="">Select approved bank offer...</option>
        {bankOffers
          .filter((offer) => offer.status === "Approved")
          .map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.bank_name} — {formatRand(offer.approved_amount)}
            </option>
          ))}
      </select>
    )}

    <input
      type="file"
      onChange={(e) => {
        if (e.target.files?.[0]) {
          setSelectedFile(e.target.files[0]);
        }
      }}
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />

    <button
      onClick={uploadDocument}
      className="rounded-2xl brand-primary-bg px-4 py-2 text-white"
    >
      Upload Document
    </button>
  </div>

  <div className="mt-6 space-y-4">
    {financeDocuments.length === 0 ? (
      <p className="text-slate-500">
        No documents uploaded yet.
      </p>
    ) : (
      financeDocuments.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div>
            <p className="font-medium text-slate-800">
              {doc.document_name}
            </p>

            <p className="text-sm text-slate-500">
              {doc.document_type}
            </p>
          </div>

          <div className="flex items-center gap-3">
  <span className="text-xs text-slate-400">
    {new Date(doc.created_at).toLocaleDateString("en-ZA")}
  </span>

  <button
    onClick={async () => {
      const { data, error } = await supabase.storage
        .from("finance-documents")
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        alert("Could not open document: " + error.message);
        return;
      }

      window.open(data.signedUrl, "_blank");
    }}
    className="rounded-2xl brand-primary-bg px-3 py-2 text-xs text-white"
  >
    Preview
  </button>

  <button
    onClick={async () => {
      const { data, error } = await supabase.storage
        .from("finance-documents")
        .createSignedUrl(doc.file_path, 60, {
          download: doc.document_name,
        });

      if (error) {
        alert("Could not download document: " + error.message);
        return;
      }

      window.open(data.signedUrl, "_blank");
    }}
    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
  >
    Download
  </button>
</div>
        </div>
      ))
    )}
  </div>
</div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              Lead Timeline
            </h2>

            <div className="mt-5 space-y-4">
              {activities.length === 0 ? (
                <p className="text-slate-500">No timeline activity yet.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="border-l-4 border-slate-300 pl-4">
                    <p className="font-medium text-slate-800">
                      {activity.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {activity.created_at
                        ? new Date(activity.created_at).toLocaleString()
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              {editingBankOfferId
                ? "Edit Bank Response"
                : "Add Bank Response"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingBankOfferId
                ? "Update the selected bank response. Approval task status will be synchronised automatically."
                : "Capture each bank separately. Approved offers automatically notify the assigned salesperson through a high-priority task."}
            </p>

            <div className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Bank / Finance Provider"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <select
                value={bankOfferStatus}
                onChange={(e) => setBankOfferStatus(e.target.value as FinanceBankOffer["status"])}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option>Submitted</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Declined</option>
              </select>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <input type="number" placeholder="Approved amount" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <input type="number" step="0.01" placeholder="Interest rate %" value={offerInterestRate} onChange={(e) => setOfferInterestRate(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <input type="number" placeholder="Deposit" value={offerDeposit} onChange={(e) => setOfferDeposit(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <input type="number" placeholder="Term months" value={offerTermMonths} onChange={(e) => setOfferTermMonths(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <input type="number" step="0.01" placeholder="Balloon %" value={offerBalloon} onChange={(e) => setOfferBalloon(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <input type="number" placeholder="Monthly instalment" value={offerMonthlyInstallment} onChange={(e) => setOfferMonthlyInstallment(e.target.value)} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">Approval Expiry Date</label>
                <input type="date" value={offerExpiryDate} onChange={(e) => setOfferExpiryDate(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>

              <textarea placeholder="Conditions" value={offerConditions} onChange={(e) => setOfferConditions(e.target.value)} className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              <textarea placeholder="Internal finance notes" value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />

              <button
                type="button"
                onClick={() => void saveBankOffer()}
                disabled={savingBankOffer}
                className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {savingBankOffer
                  ? editingBankOfferId
                    ? "Updating..."
                    : "Saving..."
                  : editingBankOfferId
                  ? "Update Bank Response"
                  : "Add Bank Response"}
              </button>

              {editingBankOfferId && (
                <button
                  type="button"
                  onClick={resetBankOfferForm}
                  disabled={savingBankOffer}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Bank Responses</h2>
            <div className="mt-5 space-y-4">
              {bankOffers.length === 0 ? (
                <p className="text-sm text-slate-500">No bank responses captured yet.</p>
              ) : (
                bankOffers.map((offer) => (
                  <div key={offer.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{offer.bank_name}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDateTime(offer.response_date)}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {offer.is_selected && (
                          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                            Customer Selected
                          </span>
                        )}
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${offer.status === "Approved" ? "bg-green-100 text-green-700" : offer.status === "Declined" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                          {offer.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <p>Amount: <strong>{formatRand(offer.approved_amount)}</strong></p>
                      <p>Instalment: <strong>{offer.monthly_installment !== null ? `${formatRand(offer.monthly_installment)} / month` : "-"}</strong></p>
                      <p>Rate: <strong>{offer.interest_rate !== null ? `${offer.interest_rate}%` : "-"}</strong></p>
                      <p>Term: <strong>{offer.term_months ? `${offer.term_months} months` : "-"}</strong></p>
                    </div>
                    {offer.conditions && <p className="mt-3 text-sm text-slate-600">Conditions: {offer.conditions}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editBankOffer(offer)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Edit Response
                      </button>

                      {offer.status === "Approved" && !offer.is_selected && (
                        <button
                          type="button"
                          onClick={() => void selectCustomerOffer(offer)}
                          disabled={selectingOfferId === offer.id}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {selectingOfferId === offer.id
                            ? "Selecting..."
                            : "Mark as Customer Selected"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>


          </div>
        </div>
      </div>

      {showLeadSummaryModal && (
        <ContextModal
          title="Lead Summary"
          subtitle="Read-only context for this finance application"
          onClose={() => setShowLeadSummaryModal(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FinanceInfo
              label="Lead ID"
              value={
                application.lead_id
                  ? `#${application.lead_id}`
                  : "-"
              }
            />

            <FinanceInfo
              label="Lead Status"
              value={leadSummary?.status || "-"}
            />

            <FinanceInfo
              label="Customer"
              value={
                leadSummary?.customer ||
                application.customer
              }
            />

            <FinanceInfo
              label="Assigned Salesperson"
              value={
                leadSummary?.assigned_user_name ||
                "Unassigned"
              }
            />

            <FinanceInfo
              label="Phone"
              value={leadSummary?.phone || "Not captured"}
            />

            <FinanceInfo
              label="Email"
              value={leadSummary?.email || "Not captured"}
            />

            <FinanceInfo
              label="Vehicle Interest"
              value={
                leadSummary?.vehicle ||
                application.vehicle ||
                "Not captured"
              }
            />

            <FinanceInfo
              label="Customer Budget"
              value={
                leadSummary?.budget ||
                formatRand(application.monthly_budget)
              }
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Recent Relevant Activity
            </h3>

            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
              {activities.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No Lead activity has been recorded.
                </p>
              ) : (
                activities.slice(0, 10).map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-semibold text-slate-800">
                      {activity.title || "Activity"}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {activity.description || "No details captured."}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {formatDateTime(activity.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </ContextModal>
      )}

      {showCustomerSummaryModal && (
        <ContextModal
          title="Customer Summary"
          subtitle="Read-only customer information for the approval process"
          onClose={() => setShowCustomerSummaryModal(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FinanceInfo
              label="Customer"
              value={
                leadSummary?.customer ||
                application.customer
              }
            />

            <FinanceInfo
              label="Phone"
              value={leadSummary?.phone || "Not captured"}
            />

            <FinanceInfo
              label="Email"
              value={leadSummary?.email || "Not captured"}
            />

            <FinanceInfo
              label="Vehicle Interest"
              value={
                leadSummary?.vehicle ||
                application.vehicle ||
                "Not captured"
              }
            />

            <FinanceInfo
              label="Monthly Budget"
              value={
                leadSummary?.budget ||
                formatRand(application.monthly_budget)
              }
            />

            <FinanceInfo
              label="Finance Status"
              value={
                application.finance_status ||
                "Submitted"
              }
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-800">
                Latest Affordability Assessment
              </h3>

              {!latestAssessment ? (
                <p className="mt-3 text-sm text-slate-500">
                  No affordability assessment found.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  <SummaryRow
                    label="Target instalment"
                    value={`${formatRand(
                      latestAssessment.target_monthly_installment
                    )} / month`}
                  />

                  <SummaryRow
                    label="Maximum vehicle price"
                    value={formatRand(
                      latestAssessment.maximum_vehicle_price
                    )}
                  />

                  <SummaryRow
                    label="Deposit"
                    value={formatRand(
                      latestAssessment.deposit_amount
                    )}
                  />

                  <SummaryRow
                    label="Estimated instalment"
                    value={
                      latestAssessment.estimated_installment !== null
                        ? `${formatRand(
                            latestAssessment.estimated_installment
                          )} / month`
                        : "Not calculated"
                    }
                  />

                  <SummaryRow
                    label="Term"
                    value={`${latestAssessment.term_months} months`}
                  />

                  <SummaryRow
                    label="Interest rate"
                    value={`${latestAssessment.interest_rate}%`}
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-800">
                Finance Documents
              </h3>

              {financeDocuments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No finance documents uploaded.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {financeDocuments.slice(0, 8).map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-slate-700">
                        {document.document_type || "Document"}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {document.document_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ContextModal>
      )}

      {showDealSummaryModal && linkedDeal && (
        <ContextModal
          title={`Deal #${linkedDeal.id} Summary`}
          subtitle="Read-only commercial context for the finance decision"
          onClose={() => setShowDealSummaryModal(false)}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FinanceInfo
              label="Customer"
              value={
                linkedDeal.customer_name ||
                application.customer
              }
            />

            <FinanceInfo
              label="Vehicle"
              value={
                linkedDeal.vehicle_name ||
                application.vehicle
              }
            />

            <FinanceInfo
              label="Deal Stage"
              value={linkedDeal.deal_stage || "Draft"}
            />

            <FinanceInfo
              label="Finance Status"
              value={
                linkedDeal.finance_status ||
                "Not Started"
              }
            />

            <FinanceInfo
              label="Sale Price"
              value={formatRand(linkedDeal.sale_price)}
            />

            <FinanceInfo
              label="Net Deal Value"
              value={formatRand(
                calculateNetDealValue(linkedDeal)
              )}
            />

            <FinanceInfo
              label="Deposit"
              value={formatRand(
                linkedDeal.deposit_amount
              )}
            />

            <FinanceInfo
              label="Trade-In"
              value={formatRand(
                linkedDeal.trade_in_value
              )}
            />

            <FinanceInfo
              label="Settlement"
              value={formatRand(
                linkedDeal.settlement_amount
              )}
            />

            <FinanceInfo
              label="Extras"
              value={formatRand(
                linkedDeal.extras_amount
              )}
            />

            <FinanceInfo
              label="Discount"
              value={formatRand(
                linkedDeal.discount_amount
              )}
            />

            <FinanceInfo
              label="Last Updated"
              value={formatDateTime(
                linkedDeal.updated_at
              )}
            />
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Deal Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {linkedDeal.notes ||
                "No Deal notes have been captured."}
            </p>
          </div>
        </ContextModal>
      )}
          </PageAccessGuard>

    </DashboardLayout>
  );
}

function ContextModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-6">{children}</div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function FinanceInfo({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value === null ||
        value === undefined ||
        value === ""
          ? "-"
          : value}
      </p>
    </div>
  );
}