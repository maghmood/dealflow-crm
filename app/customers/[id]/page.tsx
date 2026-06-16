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

  useEffect(() => {
    fetchCustomer();
    fetchDeals();
    fetchLinkedVehicle();
    fetchDocuments();
    fetchTasks();
    fetchActivities();
    fetchFinanceApplication();
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
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link
              href="/customers"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              ← Back to Customers
            </Link>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-extrabold text-blue-700">
                {getInitials(customer.customer)}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-slate-900">
                    {customer.customer || "Unnamed Customer"}
                  </h1>

                  <span
                    className={`${statusBadge(
                      customer.status
                    )} rounded-full px-3 py-1 text-xs font-bold`}
                  >
                    {customer.status || "New Lead"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Customer 360 profile generated from Lead #{customer.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            
            <WriteAccessGuard>
  <button
    type="button"
    onClick={openEditCustomerModal}
    className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
  >
    Edit Customer
  </button>
</WriteAccessGuard>
            
            <Link
              href={`/leads/${customer.id}`}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Open Lead
            </Link>

            {deals[0] && (
              <Link
                href={`/deals/${deals[0].id}`}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                Open Latest Deal
              </Link>
            )}

            {linkedVehicle && (
              <Link
                href={`/inventory/${linkedVehicle.id}`}
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

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
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

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
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
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
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
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
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

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
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

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
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
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
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
      <h2 className="mt-1 truncate text-2xl font-bold text-slate-900">
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