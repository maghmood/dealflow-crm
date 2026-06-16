"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

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

type LeadOption = {
  id: number;
  customer: string | null;
  vehicle: string | null;
  status: string | null;
  assigned_user_id: number | null;
};

type VehicleOption = {
  id: number;
  stock_code: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  price: number | null;
  status: string | null;
  linked_lead_id: number | null;
  linked_customer_name: string | null;
};

type DealForm = {
  lead_id: string;
  vehicle_id: string;
  customer_name: string;
  vehicle_name: string;
  deal_stage: string;
  finance_status: string;
  sale_price: string;
  deposit_amount: string;
  trade_in_value: string;
  settlement_amount: string;
  extras_amount: string;
  discount_amount: string;
  notes: string;
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

function emptyForm(): DealForm {
  return {
    lead_id: "",
    vehicle_id: "",
    customer_name: "",
    vehicle_name: "",
    deal_stage: "Draft",
    finance_status: "Not Started",
    sale_price: "",
    deposit_amount: "",
    trade_in_value: "",
    settlement_amount: "",
    extras_amount: "",
    discount_amount: "",
    notes: "",
  };
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

function vehicleDisplayName(vehicle: VehicleOption) {
  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${
    vehicle.variant || ""
  }`
    .replace(/\s+/g, " ")
    .trim();
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

export default function DealsPage() {
  const { profile } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("All Stages");
  const [financeFilter, setFinanceFilter] = useState("All Finance");

  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DealForm>(emptyForm());

  async function fetchDeals() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("deals")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading deals:", error.message);
      setDeals([]);
      setLoading(false);
      return;
    }

    setDeals(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchLeads() {
    if (!profile?.company_id) return;

    let query = supabase
      .from("leads")
      .select("id, customer, vehicle, status, assigned_user_id")
      .eq("company_id", profile.company_id)
      .order("id", { ascending: false })
      .limit(300);

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading leads:", error.message);
      setLeads([]);
      return;
    }

    setLeads(Array.isArray(data) ? data : []);
  }

  async function fetchVehicles() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select(
        "id, stock_code, make, model, variant, year, price, status, linked_lead_id, linked_customer_name"
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Error loading vehicles:", error.message);
      setVehicles([]);
      return;
    }

    setVehicles(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchDeals();
    fetchLeads();
    fetchVehicles();
  }, [profile?.company_id, profile?.role, profile?.id]);

  function openCreateModal() {
    setEditingDeal(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEditModal(deal: Deal) {
    setEditingDeal(deal);

    setForm({
      lead_id: deal.lead_id ? String(deal.lead_id) : "",
      vehicle_id: deal.vehicle_id ? String(deal.vehicle_id) : "",
      customer_name: deal.customer_name || "",
      vehicle_name: deal.vehicle_name || "",
      deal_stage: deal.deal_stage || "Draft",
      finance_status: deal.finance_status || "Not Started",
      sale_price: deal.sale_price ? String(deal.sale_price) : "",
      deposit_amount: deal.deposit_amount ? String(deal.deposit_amount) : "",
      trade_in_value: deal.trade_in_value ? String(deal.trade_in_value) : "",
      settlement_amount: deal.settlement_amount
        ? String(deal.settlement_amount)
        : "",
      extras_amount: deal.extras_amount ? String(deal.extras_amount) : "",
      discount_amount: deal.discount_amount
        ? String(deal.discount_amount)
        : "",
      notes: deal.notes || "",
    });

    setShowModal(true);
  }

  function handleLeadChange(leadId: string) {
    const selectedLead = leads.find((lead) => lead.id === Number(leadId));

    setForm((current) => ({
      ...current,
      lead_id: leadId,
      customer_name: selectedLead?.customer || current.customer_name,
      vehicle_name: selectedLead?.vehicle || current.vehicle_name,
    }));
  }

  function handleVehicleChange(vehicleId: string) {
    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === Number(vehicleId)
    );

    const name = selectedVehicle ? vehicleDisplayName(selectedVehicle) : "";

    setForm((current) => ({
      ...current,
      vehicle_id: vehicleId,
      vehicle_name: name || current.vehicle_name,
      sale_price: selectedVehicle?.price
        ? String(selectedVehicle.price)
        : current.sale_price,
      customer_name:
        selectedVehicle?.linked_customer_name || current.customer_name,
      lead_id: selectedVehicle?.linked_lead_id
        ? String(selectedVehicle.linked_lead_id)
        : current.lead_id,
    }));
  }

  function calculateNetDealValue(deal: Deal) {
    const sale = Number(deal.sale_price) || 0;
    const extras = Number(deal.extras_amount) || 0;
    const discount = Number(deal.discount_amount) || 0;
    const tradeIn = Number(deal.trade_in_value) || 0;
    const settlement = Number(deal.settlement_amount) || 0;

    return sale + extras - discount - tradeIn + settlement;
  }

  async function addLeadActivity(
    leadId: number | null,
    title: string,
    description: string,
    color: string
  ) {
    if (!leadId || !profile?.company_id) return;

    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      title,
      description,
      activity_type: "deal",
      color,
      company_id: profile.company_id,
    });

    if (error) {
      console.error("Error saving deal lead activity:", error.message);
    }
  }

  async function saveDeal() {
    if (!profile?.company_id || !profile?.id) return;

    if (!form.customer_name.trim()) {
      alert("Please enter or select a customer.");
      return;
    }

    if (!form.vehicle_name.trim()) {
      alert("Please enter or select a vehicle.");
      return;
    }

    const selectedLead = form.lead_id
      ? leads.find(
          (lead) =>
            lead.id === Number(form.lead_id)
        )
      : null;

    if (!editingDeal && selectedLead) {
      const activeStages = [
        "Draft",
        "Offer Sent",
        "Finance Submitted",
        "Finance Approved",
        "Ready for Delivery",
      ];

      const {
        data: duplicateDeal,
        error: duplicateError,
      } = await supabase
        .from("deals")
        .select("id, deal_stage")
        .eq("company_id", profile.company_id)
        .eq("lead_id", selectedLead.id)
        .in("deal_stage", activeStages)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (duplicateError) {
        alert(
          "Could not check for an existing deal: " +
            duplicateError.message
        );
        return;
      }

      if (duplicateDeal) {
        alert(
          `This lead already has active Deal #${duplicateDeal.id}. Open and update that Deal instead of creating a duplicate.`
        );
        return;
      }
    }

    setSaving(true);

    const payload = {
      company_id: profile.company_id,
      lead_id: form.lead_id
        ? Number(form.lead_id)
        : null,
      vehicle_id: form.vehicle_id
        ? Number(form.vehicle_id)
        : null,
      customer_name:
        form.customer_name.trim(),
      vehicle_name:
        form.vehicle_name.trim(),
      deal_stage:
        form.deal_stage || "Draft",
      finance_status:
        form.finance_status ||
        "Not Started",
      sale_price: form.sale_price
        ? Number(form.sale_price)
        : null,
      deposit_amount: form.deposit_amount
        ? Number(form.deposit_amount)
        : null,
      trade_in_value:
        form.trade_in_value
          ? Number(form.trade_in_value)
          : null,
      settlement_amount:
        form.settlement_amount
          ? Number(form.settlement_amount)
          : null,
      extras_amount:
        form.extras_amount
          ? Number(form.extras_amount)
          : null,
      discount_amount:
        form.discount_amount
          ? Number(form.discount_amount)
          : null,
      assigned_user_id:
        selectedLead?.assigned_user_id ||
        editingDeal?.assigned_user_id ||
        profile.id,
      notes: form.notes.trim() || null,
      updated_at:
        new Date().toISOString(),
    };

    try {
      let savedDealId: number;

      if (editingDeal) {
        const { data, error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", editingDeal.id)
          .eq(
            "company_id",
            profile.company_id
          )
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

        await addLeadActivity(
          payload.lead_id,
          "Deal Updated",
          `Deal #${savedDealId} for ${payload.vehicle_name} was updated. Stage: ${payload.deal_stage}. Finance: ${payload.finance_status}.`,
          "blue"
        );
      } else {
        const { data, error } = await supabase
          .from("deals")
          .insert(payload)
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

        await addLeadActivity(
          payload.lead_id,
          "Deal Created",
          `Deal #${savedDealId} was created for ${payload.vehicle_name}. Stage: ${payload.deal_stage}.`,
          "green"
        );
      }

      if (payload.vehicle_id) {
        const selectedVehicle =
          vehicles.find(
            (vehicle) =>
              vehicle.id ===
              payload.vehicle_id
          );

        const { error: vehicleError } =
          await supabase
            .from("inventory_vehicles")
            .update({
              linked_lead_id:
                payload.lead_id,
              linked_customer_name:
                payload.customer_name,
              status:
                selectedVehicle?.status ===
                  "Sold" ||
                selectedVehicle?.status ===
                  "Delivered"
                  ? selectedVehicle.status
                  : "Reserved",
            })
            .eq(
              "id",
              payload.vehicle_id
            )
            .eq(
              "company_id",
              profile.company_id
            );

        if (vehicleError) {
          console.error(
            "Deal saved, but vehicle reservation could not be updated:",
            vehicleError.message
          );
        }
      }

      const wasEditing = Boolean(editingDeal);

      setShowModal(false);
      setEditingDeal(null);
      setForm(emptyForm());

      await Promise.all([
        fetchDeals(),
        fetchVehicles(),
      ]);

      alert(
        wasEditing
          ? `Deal #${savedDealId} updated successfully.`
          : `Deal #${savedDealId} created successfully.`
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredDeals = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return deals.filter((deal) => {
      if (stageFilter !== "All Stages" && deal.deal_stage !== stageFilter) {
        return false;
      }

      if (
        financeFilter !== "All Finance" &&
        deal.finance_status !== financeFilter
      ) {
        return false;
      }

      if (!search) return true;

      const searchable = [
        deal.id,
        deal.customer_name,
        deal.vehicle_name,
        deal.deal_stage,
        deal.finance_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });
  }, [deals, searchTerm, stageFilter, financeFilter]);

  const totalDeals = deals.length;

  const openDeals = deals.filter(
    (deal) =>
      deal.deal_stage !== "Delivered" &&
      deal.deal_stage !== "Lost"
  ).length;

  const approvedDeals = deals.filter(
    (deal) => deal.finance_status === "Approved"
  ).length;

  const deliveredDeals = deals.filter(
    (deal) => deal.deal_stage === "Delivered"
  ).length;

  const pipelineValue = deals
    .filter((deal) => deal.deal_stage !== "Lost")
    .reduce((sum, deal) => sum + calculateNetDealValue(deal), 0);

  return (
  <DashboardLayout>
    <PageAccessGuard module="deals">
      <ReadOnlyNotice />
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">Deals</h1>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-700">
                {totalDeals}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Manage customer deals, finance progress and delivery status.
            </p>
          </div>

          <WriteAccessGuard>
            <button
              onClick={openCreateModal}
              className="rounded-xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              + Create Deal
            </button>
          </WriteAccessGuard>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
        >
          <MetricCard label="Total Deals" value={totalDeals} />
          <MetricCard label="Open Deals" value={openDeals} />
          <MetricCard label="Finance Approved" value={approvedDeals} />
          <MetricCard label="Delivered" value={deliveredDeals} />
          <MetricCard label="Pipeline Value" value={formatRand(pipelineValue)} />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 xl:grid-cols-[1fr_190px_190px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, vehicle, stage or finance status..."
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option>All Stages</option>
              {DEAL_STAGES.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>

            <select
              value={financeFilter}
              onChange={(e) => setFinanceFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option>All Finance</option>
              {FINANCE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm ring-1 ring-slate-200">
            Loading deals...
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              No deals found
            </h2>
            <p className="mt-2 text-slate-500">
              Create your first deal to start tracking sales transactions.
            </p>
            <WriteAccessGuard>
              <button
                onClick={openCreateModal}
                className="mt-5 rounded-xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
              >
                + Create Deal
              </button>
            </WriteAccessGuard>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="grid grid-cols-[80px_1.2fr_1.5fr_150px_150px_140px_170px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <div>Deal</div>
              <div>Customer</div>
              <div>Vehicle</div>
              <div>Stage</div>
              <div>Finance</div>
              <div>Value</div>
              <div className="text-right">Action</div>
            </div>

            {filteredDeals.map((deal) => (
              <div
  key={deal.id}
  className="grid grid-cols-[80px_1.2fr_1.5fr_150px_150px_140px_170px] gap-4 border-b border-slate-100 px-5 py-4 text-sm last:border-b-0 hover:bg-slate-50"

              >
                <div>
                  <p className="font-bold text-slate-900">#{deal.id}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(deal.created_at)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {deal.customer_name || "-"}
                  </p>

                  {deal.lead_id && (
                    <Link
                      href={`/leads/${deal.lead_id}`}
                      className="mt-1 block text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Open lead →
                    </Link>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {deal.vehicle_name || "-"}
                  </p>

                  {deal.vehicle_id && (
                    <Link
                      href={`/inventory/${deal.vehicle_id}`}
                      className="mt-1 block text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Open vehicle →
                    </Link>
                  )}
                </div>

                <div>
                  <span
                    className={`${stageBadge(
                      deal.deal_stage
                    )} rounded-full px-3 py-1 text-xs font-bold`}
                  >
                    {deal.deal_stage || "Draft"}
                  </span>
                </div>

                <div>
                  <span
                    className={`${financeBadge(
                      deal.finance_status
                    )} rounded-full px-3 py-1 text-xs font-bold`}
                  >
                    {deal.finance_status || "Not Started"}
                  </span>
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    {formatRand(calculateNetDealValue(deal))}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Sale {formatRand(deal.sale_price)}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
  <Link
    href={`/deals/${deal.id}`}
    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
  >
    View
  </Link>

  <WriteAccessGuard>
    <button
      onClick={() => openEditModal(deal)}
      className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      Edit
    </button>
  </WriteAccessGuard>
</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-10 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {editingDeal ? "Edit Deal" : "Create Deal"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Link a customer, lead and vehicle into a trackable sales deal.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Link Lead
                </label>
                <select
                  value={form.lead_id}
                  onChange={(e) => handleLeadChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  <option value="">No lead selected</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      #{lead.id} • {lead.customer || "Unknown Customer"}
                      {lead.vehicle ? ` • ${lead.vehicle}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Deal Stage
                </label>
                <select
                  value={form.deal_stage}
                  onChange={(e) =>
                    setForm({ ...form, deal_stage: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  {DEAL_STAGES.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Link Vehicle
                </label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  <option value="">No vehicle selected</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      #{vehicle.id} • {vehicleDisplayName(vehicle)}
                      {vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""}
                      {vehicle.status ? ` • ${vehicle.status}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Finance Status
                </label>
                <select
                  value={form.finance_status}
                  onChange={(e) =>
                    setForm({ ...form, finance_status: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  {FINANCE_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({ ...form, customer_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Vehicle Name
                </label>
                <input
                  type="text"
                  value={form.vehicle_name}
                  onChange={(e) =>
                    setForm({ ...form, vehicle_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Sale Price
                </label>
                <input
                  type="number"
                  value={form.sale_price}
                  onChange={(e) =>
                    setForm({ ...form, sale_price: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Deposit
                </label>
                <input
                  type="number"
                  value={form.deposit_amount}
                  onChange={(e) =>
                    setForm({ ...form, deposit_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Trade-In Value
                </label>
                <input
                  type="number"
                  value={form.trade_in_value}
                  onChange={(e) =>
                    setForm({ ...form, trade_in_value: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Settlement Amount
                </label>
                <input
                  type="number"
                  value={form.settlement_amount}
                  onChange={(e) =>
                    setForm({ ...form, settlement_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Extras
                </label>
                <input
                  type="number"
                  value={form.extras_amount}
                  onChange={(e) =>
                    setForm({ ...form, extras_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Discount
                </label>
                <input
                  type="number"
                  value={form.discount_amount}
                  onChange={(e) =>
                    setForm({ ...form, discount_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-sm font-medium text-slate-600">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Finance notes, delivery notes, discount motivation, trade-in notes..."
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveDeal}
                disabled={saving}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Deal"}
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