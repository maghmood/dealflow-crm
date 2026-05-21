"use client";

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

  const [loading, setLoading] = useState(true);

  const totalDealValue = useMemo(() => {
    return deals.reduce((sum, deal) => sum + calculateNetDealValue(deal), 0);
  }, [deals]);

  const openTasks = tasks.filter((task) => task.status !== "Completed").length;

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