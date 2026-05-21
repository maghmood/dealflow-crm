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

const DEAL_STAGES = [
  "Draft",
  "Offer Sent",
  "Finance Submitted",
  "Finance Approved",
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
  { title: "Finance approved", category: "Finance" },
  { title: "Deposit received", category: "Finance" },
  { title: "Invoice prepared", category: "Admin" },
  { title: "FICA / customer documents checked", category: "Admin" },
  { title: "Trade-in documents checked", category: "Trade-In" },
  { title: "Settlement amount confirmed", category: "Trade-In" },
  { title: "Vehicle inspection completed", category: "Vehicle" },
  { title: "Roadworthy / licensing checked", category: "Vehicle" },
  { title: "Delivery date confirmed", category: "Delivery" },
  { title: "Customer handover completed", category: "Delivery" },
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

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();

  const dealId = Number(params.id);

  const [deal, setDeal] = useState<Deal | null>(null);
const [activities, setActivities] = useState<DealActivity[]>([]);
const [checklistItems, setChecklistItems] = useState<DealChecklistItem[]>([]);
const [documents, setDocuments] = useState<DealDocument[]>([]);
const [documentType, setDocumentType] = useState("Invoice");
const [uploadingDocument, setUploadingDocument] = useState(false);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

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

  async function saveDealUpdates() {
    if (!profile?.company_id || !deal) return;

    setSaving(true);

    const oldStage = deal.deal_stage || "Draft";
    const oldFinance = deal.finance_status || "Not Started";

    const { error } = await supabase
      .from("deals")
      .update({
        deal_stage: stageDraft,
        finance_status: financeDraft,
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

  async function markReadyForDelivery() {
    setStageDraft("Ready for Delivery");
    setFinanceDraft("Approved");
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

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Deal Controls</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update the current deal stage, finance progress and deal notes.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Deal Stage
                </label>
                <select
                  value={stageDraft}
                  onChange={(e) => setStageDraft(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                >
                  {DEAL_STAGES.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Finance Status
                </label>
                <select
                  value={financeDraft}
                  onChange={(e) => setFinanceDraft(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                >
                  {FINANCE_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Deal Notes
                </label>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="mt-1 min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  placeholder="Finance notes, customer notes, delivery instructions..."
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => quickSetStage("Finance Submitted")}
                className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100"
              >
                Set Finance Submitted
              </button>

              <button
                onClick={() => quickSetStage("Finance Approved")}
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
              >
                Set Finance Approved
              </button>

              <button
                onClick={markReadyForDelivery}
                className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100"
              >
                Ready for Delivery
              </button>
            </div>

            <button
              onClick={saveDealUpdates}
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Deal Updates"}
            </button>
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
                    className="mt-1 h-5 w-5 rounded border-slate-300"
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