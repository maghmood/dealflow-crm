"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { canManageInventory } from "@/lib/auth";

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

type LeadOption = {
  id: number;
  customer: string | null;
  vehicle: string | null;
  status: string | null;
  assigned_user_id: number | null;
};

type VehicleActivity = {
  id: number;
  company_id: number | null;
  vehicle_id: number;
  lead_id: number | null;
  title: string;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string | null;
};

const FALLBACK_IMAGES: Record<string, string> = {
  volkswagen:
    "https://images.unsplash.com/photo-1617814076668-388488c4aefb?auto=format&fit=crop&w=1200&q=80",
  toyota:
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80",
  ford:
    "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1200&q=80",
  bmw:
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
  audi:
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
  mercedes:
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80",
  "mercedes-benz":
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80",
  hyundai:
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=1200&q=80",
  kia:
    "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80",
  nissan:
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
  suzuki:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
  range:
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
  "range rover":
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
};

function formatRand(value: number | null | undefined) {
  if (!value && value !== 0) return "R -";

  return `R ${Number(value).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  })}`;
}

function formatKm(value: number | null | undefined) {
  if (!value && value !== 0) return "-";
  return `${Number(value).toLocaleString("en-ZA")} km`;
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

function vehicleTitle(vehicle: InventoryVehicle | null) {
  if (!vehicle) return "";

  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function vehicleSubtitle(vehicle: InventoryVehicle | null) {
  if (!vehicle) return "";
  return `${vehicle.variant || ""}`.replace(/\s+/g, " ").trim();
}

function statusBadge(status: string | null) {
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

function getVehicleImage(vehicle: InventoryVehicle | null) {
  if (!vehicle) return null;

  if (vehicle.image_url && vehicle.image_url.trim()) {
    return vehicle.image_url.trim();
  }

  const make = (vehicle.make || "").toLowerCase().trim();
  return FALLBACK_IMAGES[make] || null;
}

function estimateMonthlyPayment(price: number | null) {
  if (!price) return null;

  const deposit = price * 0.1;
  const financeAmount = price - deposit;
  const annualRate = 0.135;
  const monthlyRate = annualRate / 12;
  const term = 72;

  return (
    (financeAmount * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -term))
  );
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const canEditInventory = canManageInventory(profile?.role);

  const vehicleId = Number(params.id);

  const [vehicle, setVehicle] = useState<InventoryVehicle | null>(null);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [activities, setActivities] = useState<VehicleActivity[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const title = vehicleTitle(vehicle);
  const subtitle = vehicleSubtitle(vehicle);
  const imageUrl = getVehicleImage(vehicle);
  const monthlyPayment = estimateMonthlyPayment(vehicle?.price || null);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return leads.find((lead) => lead.id === Number(selectedLeadId)) || null;
  }, [selectedLeadId, leads]);

  async function fetchVehicle() {
    if (!profile?.company_id || !vehicleId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("company_id", profile.company_id)
      .single();

    if (error) {
      console.error("Error loading vehicle:", error.message);
      setVehicle(null);
      setLoading(false);
      return;
    }

    setVehicle(data);
    setSelectedLeadId(data?.linked_lead_id ? String(data.linked_lead_id) : "");
    setLoading(false);
  }

  async function fetchLeads() {
    if (!profile?.company_id) return;

    if (!canEditInventory) {
      setLeads([]);
      return;
    }

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
      console.error("Error loading lead options:", error.message);
      setLeads([]);
      return;
    }

    setLeads(Array.isArray(data) ? data : []);
  }

  async function fetchVehicleActivities() {
    if (!profile?.company_id || !vehicleId) return;

    const { data, error } = await supabase
      .from("vehicle_activities")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading vehicle activities:", error.message);
      setActivities([]);
      return;
    }

    setActivities(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchVehicle();
    fetchLeads();
    fetchVehicleActivities();
  }, [profile?.company_id, profile?.role, profile?.id, vehicleId]);

  async function addLeadActivity(
    leadId: number | null,
    activityTitle: string,
    description: string,
    color: string
  ) {
    if (!leadId || !profile?.company_id) return;

    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      title: activityTitle,
      description,
      activity_type: "inventory",
      color,
      company_id: profile.company_id,
    });

    if (error) {
      console.error("Error saving lead activity:", error.message);
    }
  }

  async function addVehicleActivity(
    activityTitle: string,
    description: string,
    color: string,
    leadId?: number | null
  ) {
    if (!profile?.company_id || !vehicle) return;

    const { error } = await supabase.from("vehicle_activities").insert({
      company_id: profile.company_id,
      vehicle_id: vehicle.id,
      lead_id: leadId || null,
      title: activityTitle,
      description,
      activity_type: "vehicle",
      color,
    });

    if (error) {
      console.error("Error saving vehicle activity:", error.message);
    }
  }

  async function reserveVehicle() {
  if (!canEditInventory) {
    alert("Only Admin and Manager users can reserve inventory vehicles.");
    return;
  }

    if (!profile?.company_id || !vehicle) return;

    if (!selectedLead) {
      alert("Please select a lead before reserving this vehicle.");
      return;
    }

    setSaving(true);

    const vehicleName = `${vehicle.year || ""} ${vehicle.make || ""} ${
      vehicle.model || ""
    } ${vehicle.variant || ""}`
      .replace(/\s+/g, " ")
      .trim();

    const previousStatus = vehicle.status || "Available";
    const previousLeadName = vehicle.linked_customer_name || "No previous lead";

    const { error: vehicleError } = await supabase
      .from("inventory_vehicles")
      .update({
        status: "Reserved",
        linked_lead_id: selectedLead.id,
        linked_customer_name: selectedLead.customer || null,
      })
      .eq("id", vehicle.id)
      .eq("company_id", profile.company_id);

    if (vehicleError) {
      alert("Error reserving vehicle: " + vehicleError.message);
      setSaving(false);
      return;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({
        vehicle: vehicleName,
      })
      .eq("id", selectedLead.id)
      .eq("company_id", profile.company_id);

    if (leadError) {
      console.error("Error updating lead vehicle:", leadError.message);
    }

    await addLeadActivity(
      selectedLead.id,
      "Vehicle Reserved",
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } was reserved for this lead.`,
      "orange"
    );

    await addVehicleActivity(
      "Vehicle Reserved",
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } was reserved for ${
        selectedLead.customer || `Lead #${selectedLead.id}`
      }. Previous status: ${previousStatus}. Previous link: ${previousLeadName}.`,
      "orange",
      selectedLead.id
    );

    setSaving(false);
    await fetchVehicle();
    await fetchLeads();
    await fetchVehicleActivities();
  }

  async function releaseReservation() {
  if (!canEditInventory) {
    alert("Only Admin and Manager users can release inventory reservations.");
    return;
  }

    if (!profile?.company_id || !vehicle) return;

    if (
      ["Sale Pending", "In Prep", "Ready for Delivery", "Sold", "Delivered"].includes(
        vehicle.status || ""
      )
    ) {
      alert(
        "This vehicle is controlled by an active sale or completed delivery. Update it from the Deal workflow."
      );
      return;
    }

    const previousLeadId = vehicle.linked_lead_id;
    const previousLeadName =
      vehicle.linked_customer_name ||
      (previousLeadId ? `Lead #${previousLeadId}` : "No linked lead");

    setSaving(true);

    const vehicleName = `${vehicle.year || ""} ${vehicle.make || ""} ${
      vehicle.model || ""
    } ${vehicle.variant || ""}`
      .replace(/\s+/g, " ")
      .trim();

    const { error } = await supabase
      .from("inventory_vehicles")
      .update({
        status: "Available",
        linked_lead_id: null,
        linked_customer_name: null,
      })
      .eq("id", vehicle.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error releasing reservation: " + error.message);
      setSaving(false);
      return;
    }

    await addLeadActivity(
      previousLeadId,
      "Vehicle Reservation Released",
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } reservation was released and the vehicle is now available.`,
      "red"
    );

    await addVehicleActivity(
      "Reservation Released",
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } was released from ${previousLeadName} and returned to Available stock.`,
      "red",
      previousLeadId
    );

    setSelectedLeadId("");
    setSaving(false);
    await fetchVehicle();
    await fetchLeads();
    await fetchVehicleActivities();
  }

  async function updateVehicleStatus(newStatus: string) {
  if (!canEditInventory) {
    alert("Only Admin and Manager users can change inventory status.");
    return;
  }

    if (!profile?.company_id || !vehicle) return;

    if (
      ["Sale Pending", "In Prep", "Ready for Delivery", "Sold", "Delivered"].includes(
        vehicle.status || ""
      )
    ) {
      alert(
        "This vehicle status is controlled by the Deal delivery workflow."
      );
      return;
    }

    setSaving(true);

    const oldStatus = vehicle.status || "Available";

    const vehicleName = `${vehicle.year || ""} ${vehicle.make || ""} ${
      vehicle.model || ""
    } ${vehicle.variant || ""}`
      .replace(/\s+/g, " ")
      .trim();

    const { error } = await supabase
      .from("inventory_vehicles")
      .update({
        status: newStatus,
      })
      .eq("id", vehicle.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error updating vehicle status: " + error.message);
      setSaving(false);
      return;
    }

    await addLeadActivity(
      vehicle.linked_lead_id,
      `Vehicle Marked as ${newStatus}`,
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } was marked as ${newStatus}.`,
      newStatus === "Sold" ? "green" : "blue"
    );

    await addVehicleActivity(
      `Vehicle Marked as ${newStatus}`,
      `${vehicleName}${
        vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""
      } status changed from ${oldStatus} to ${newStatus}.`,
      newStatus === "Sold"
        ? "green"
        : newStatus === "Delivered"
        ? "purple"
        : "blue",
      vehicle.linked_lead_id
    );

    setSaving(false);
    await fetchVehicle();
    await fetchVehicleActivities();
  }

async function createDealFromVehicle() {
  if (!canEditInventory) {
    alert("Create the Deal from the Lead page. Inventory actions are limited to Admin and Manager.");
    return;
  }

  if (!profile?.company_id || !vehicle) return;

  if (!vehicle.linked_lead_id) {
    alert("Please reserve or link this vehicle to a lead before creating a deal.");
    return;
  }

  setSaving(true);

  const vehicleName = `${vehicle.year || ""} ${vehicle.make || ""} ${
    vehicle.model || ""
  } ${vehicle.variant || ""}`
    .replace(/\s+/g, " ")
    .trim();

  const customerName =
    vehicle.linked_customer_name || `Lead #${vehicle.linked_lead_id}`;

  const { data: existingDeal, error: existingDealError } = await supabase
    .from("deals")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("vehicle_id", vehicle.id)
    .eq("lead_id", vehicle.linked_lead_id)
    .neq("deal_stage", "Lost")
    .maybeSingle();

  if (existingDealError) {
    alert("Error checking existing deals: " + existingDealError.message);
    setSaving(false);
    return;
  }

  if (existingDeal) {
    alert(
      `A deal already exists for this vehicle and lead. Opening Deals page now.`
    );
    setSaving(false);
    router.push("/deals");
    return;
  }

  const payload = {
    company_id: profile.company_id,
    lead_id: vehicle.linked_lead_id,
    vehicle_id: vehicle.id,
    customer_name: customerName,
    vehicle_name: vehicleName,
    deal_stage: "Draft",
    finance_status: "Not Started",
    sale_price: vehicle.price || null,
    deposit_amount: null,
    trade_in_value: null,
    settlement_amount: null,
    extras_amount: null,
    discount_amount: null,
    assigned_user_id: profile.id || null,
    notes: vehicle.stock_code
      ? `Created from reserved inventory vehicle. Stock code: ${vehicle.stock_code}`
      : "Created from reserved inventory vehicle.",
    updated_at: new Date().toISOString(),
  };

  const { data: createdDeal, error: createDealError } = await supabase
    .from("deals")
    .insert(payload)
    .select()
    .single();

  if (createDealError) {
    alert("Error creating deal: " + createDealError.message);
    setSaving(false);
    return;
  }

  await addLeadActivity(
    vehicle.linked_lead_id,
    "Deal Created",
    `Deal #${createdDeal?.id || ""} was created from reserved vehicle ${
      vehicleName || "this vehicle"
    }.`,
    "green"
  );

  await addVehicleActivity(
    "Deal Created",
    `Deal #${createdDeal?.id || ""} was created for ${customerName}. Vehicle: ${
      vehicleName || "Vehicle"
    }.`,
    "green",
    vehicle.linked_lead_id
  );

  setSaving(false);
  await fetchVehicleActivities();

  router.push("/deals");
}

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          Loading vehicle details...
        </div>
      </DashboardLayout>
    );
  }

  if (!vehicle) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Vehicle not found
          </h1>
          <p className="mt-2 text-slate-500">
            This vehicle could not be found or you do not have access to it.
          </p>
          <button
            onClick={() => router.push("/inventory")}
            className="mt-5 rounded-2xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Inventory
          </button>
        </div>
      </DashboardLayout>
    );
  }

return (
  <DashboardLayout>
    <PageAccessGuard module="inventory">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link
              href="/inventory"
              className="text-sm font-bold text-blue-700 hover:underline"
            >
              ← Back to Inventory
            </Link>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                {title || "Vehicle Detail"}
              </h1>

              <span
                className={`${statusBadge(
                  vehicle.status
                )} rounded-full px-3 py-1 text-xs font-extrabold`}
              >
                {vehicle.status || "Available"}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {subtitle || "No variant captured"}
              {vehicle.stock_code ? ` • Stock ${vehicle.stock_code}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
  <Link
    href="/inventory"
    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold text-slate-700 hover:bg-slate-50"
  >
    Inventory
  </Link>

  {canEditInventory && vehicle.linked_lead_id && (
    <button
      type="button"
      onClick={createDealFromVehicle}
      disabled={saving}
      className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
    >
      {saving ? "Working..." : "Create Deal"}
    </button>
  )}

  {vehicle.linked_lead_id && (
    <Link
      href={`/leads/${vehicle.linked_lead_id}`}
      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
    >
      Open Linked Lead
    </Link>
  )}
</div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="relative h-[360px] bg-slate-100">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title || "Vehicle"}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                  <div className="text-6xl">🚗</div>
                  <p className="mt-2 text-sm">No vehicle image</p>
                </div>
              )}

              <span
                className={`${statusBadge(
                  vehicle.status
                )} absolute right-4 top-4 rounded-full px-4 py-2 text-xs font-extrabold shadow-lg`}
              >
                {vehicle.status || "Available"}
              </span>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Retail Price
                </p>
                <p className="mt-1 text-2xl font-extrabold text-slate-950">
                  {formatRand(vehicle.price)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Est. Finance
                </p>
                <p className="mt-1 text-xl font-extrabold text-blue-700">
                  {monthlyPayment ? `${formatRand(monthlyPayment)} p/m` : "-"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mileage
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-950">
                  {formatKm(vehicle.mileage)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Location
                </p>
                <p className="mt-1 truncate text-xl font-extrabold text-slate-950">
                  {vehicle.location || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {canEditInventory ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Reservation Workflow
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Reserve this vehicle for a lead, release it back to stock, or
                  move it into sold/delivered status.
                </p>

                <div className="mt-5">
                  <label className="text-sm font-medium text-slate-600">
                    Select Lead
                  </label>

                  <select
                    value={selectedLeadId}
                    onChange={(event) =>
                      setSelectedLeadId(event.target.value)
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-sm"
                  >
                    <option value="">No lead selected</option>

                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        #{lead.id} • {lead.customer || "Unknown Customer"}
                        {lead.vehicle
                          ? ` • Current: ${lead.vehicle}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={reserveVehicle}
                    disabled={saving}
                    className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : "Reserve for Selected Lead"}
                  </button>

                  <button
                    type="button"
                    onClick={releaseReservation}
                    disabled={saving || !vehicle.linked_lead_id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Release Reservation
                  </button>

                  <button
                    type="button"
                    onClick={createDealFromVehicle}
                    disabled={saving || !vehicle.linked_lead_id}
                    className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create Deal from Vehicle
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateVehicleStatus("Sold")}
                      disabled={saving}
                      className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                    >
                      Mark Sold
                    </button>

                    <button
                      type="button"
                      onClick={() => updateVehicleStatus("Delivered")}
                      disabled={saving}
                      className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="text-lg font-bold text-blue-900">
                  Inventory View Only
                </h2>

                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Sales users can browse vehicle information and open the linked
                  Lead. Reservations, releases and stock-status changes are
                  managed by an Admin or Manager.
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Linked Customer / Lead
              </h2>

              {vehicle.linked_lead_id ? (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                    Reserved / Linked To
                  </p>

                  <Link
                    href={`/leads/${vehicle.linked_lead_id}`}
                    className="mt-1 block text-lg font-bold text-blue-800 hover:underline"
                  >
                    {vehicle.linked_customer_name ||
                      `Lead #${vehicle.linked_lead_id}`}
                  </Link>

                  <p className="mt-2 text-sm text-blue-700">
                    This vehicle is currently connected to an active lead.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    No linked lead
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the reservation workflow above to link this vehicle to a
                    customer lead.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">
              Vehicle Information
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Info label="Make" value={vehicle.make} />
              <Info label="Model" value={vehicle.model} />
              <Info label="Variant" value={vehicle.variant} />
              <Info label="Year" value={vehicle.year} />
              <Info label="Colour" value={vehicle.colour} />
              <Info label="Stock Code" value={vehicle.stock_code} />
              <Info label="Registration" value={vehicle.registration_number} />
              <Info label="VIN" value={vehicle.vin} />
              <Info label="Status" value={vehicle.status || "Available"} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Pricing Snapshot
            </h2>

            <div className="mt-5 space-y-3">
              <PriceRow label="Retail Price" value={formatRand(vehicle.price)} />
              <PriceRow
                label="Cost Price"
                value={formatRand(vehicle.cost_price)}
              />
              <PriceRow
                label="Est. Monthly"
                value={monthlyPayment ? `${formatRand(monthlyPayment)} p/m` : "-"}
              />
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Monthly estimate is based on 10% deposit, 72 months and an
              indicative 13.5% annual rate.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Vehicle Notes</h2>

          {vehicle.notes ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {vehicle.notes}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No notes captured for this vehicle yet.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Vehicle Activity Timeline
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Track reservation, release, sold and delivery changes for this
                vehicle.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {activities.length}
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No vehicle activity yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                New reservation and status actions will appear here.
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

                    {activity.lead_id && (
                      <Link
                        href={`/leads/${activity.lead_id}`}
                        className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline"
                      >
                        Open related lead →
                      </Link>
                    )}
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

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}