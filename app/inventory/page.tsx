"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type VehicleForm = {
  stock_code: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  mileage: string;
  price: string;
  cost_price: string;
  colour: string;
  vin: string;
  registration_number: string;
  image_url: string;
  status: string;
  location: string;
  notes: string;
  linked_lead_id: string;
};

const STATUS_OPTIONS = [
  "Available",
  "Reserved",
  "Sold",
  "In Prep",
  "Delivered",
  "On Hold",
];

const FALLBACK_IMAGES: Record<string, string> = {
  volkswagen:
    "https://images.unsplash.com/photo-1617814076668-388488c4aefb?auto=format&fit=crop&w=900&q=80",
  toyota:
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=900&q=80",
  ford:
    "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=900&q=80",
  bmw:
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=80",
  audi:
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=900&q=80",
  mercedes:
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=80",
  "mercedes-benz":
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=80",
  hyundai:
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=900&q=80",
  kia:
    "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=80",
  nissan:
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80",
  suzuki:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
  range:
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80",
  "range rover":
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80",
};

function emptyForm(): VehicleForm {
  return {
    stock_code: "",
    make: "",
    model: "",
    variant: "",
    year: "",
    mileage: "",
    price: "",
    cost_price: "",
    colour: "",
    vin: "",
    registration_number: "",
    image_url: "",
    status: "Available",
    location: "",
    notes: "",
    linked_lead_id: "",
  };
}

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

function vehicleTitle(vehicle: InventoryVehicle) {
  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function vehicleSubtitle(vehicle: InventoryVehicle) {
  return `${vehicle.variant || ""}`.replace(/\s+/g, " ").trim();
}

function statusBadge(status: string | null) {
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

function getVehicleImage(vehicle: InventoryVehicle) {
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

function VehiclePhoto({
  vehicle,
  title,
  height,
  width,
  rounded,
}: {
  vehicle: InventoryVehicle;
  title: string;
  height: number;
  width: string | number;
  rounded: string;
}) {
  const imageUrl = getVehicleImage(vehicle);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: rounded,
        overflow: "hidden",
        backgroundColor: "#f1f5f9",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title || "Vehicle"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
          <div className="text-3xl">🚗</div>
          <p className="mt-1 text-xs">No image</p>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { profile } = useAuth();
  const canEditInventory = canManageInventory(profile?.role);

  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [sortMode, setSortMode] = useState("Newest First");
  const [viewMode, setViewMode] = useState<"grid" | "rows">("grid");

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<InventoryVehicle | null>(
    null
  );
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<VehicleForm>(emptyForm());

  async function fetchVehicles() {
    if (!profile?.company_id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading inventory:", error.message);
      setVehicles([]);
      setLoading(false);
      return;
    }

    setVehicles(Array.isArray(data) ? data : []);
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
      console.error("Error loading lead options:", error.message);
      setLeads([]);
      return;
    }

    setLeads(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchVehicles();
    fetchLeads();
  }, [profile?.company_id, profile?.role, profile?.id]);

  function openCreateVehicleModal() {
    if (!canEditInventory) {
      alert("Only Admin and Manager users can add inventory vehicles.");
      return;
    }

    setEditingVehicle(null);
    setForm(emptyForm());
    setShowVehicleModal(true);
  }

  function openEditVehicleModal(vehicle: InventoryVehicle) {
    if (!canEditInventory) {
      alert("Only Admin and Manager users can edit inventory vehicles.");
      return;
    }

    setEditingVehicle(vehicle);

    setForm({
      stock_code: vehicle.stock_code || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      variant: vehicle.variant || "",
      year: vehicle.year ? String(vehicle.year) : "",
      mileage: vehicle.mileage ? String(vehicle.mileage) : "",
      price: vehicle.price ? String(vehicle.price) : "",
      cost_price: vehicle.cost_price ? String(vehicle.cost_price) : "",
      colour: vehicle.colour || "",
      vin: vehicle.vin || "",
      registration_number: vehicle.registration_number || "",
      image_url: vehicle.image_url || "",
      status: vehicle.status || "Available",
      location: vehicle.location || "",
      notes: vehicle.notes || "",
      linked_lead_id: vehicle.linked_lead_id
        ? String(vehicle.linked_lead_id)
        : "",
    });

    setShowVehicleModal(true);
  }

  async function uploadVehicleImage(file: File) {
    if (!profile?.company_id) return;

    if (!canEditInventory) {
      alert("Only Admin and Manager users can upload inventory images.");
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.includes(".")
        ? file.name.split(".").pop()
        : "jpg";

      const safeStock =
        form.stock_code.trim() ||
        editingVehicle?.stock_code ||
        `${form.make}-${form.model}` ||
        "vehicle";

      const safeName = safeStock
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

      const filePath = `${profile.company_id}/inventory/${safeName}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("inventory-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        alert(
          "Image upload failed. Make sure Supabase Storage bucket 'inventory-images' exists and is public. Error: " +
            uploadError.message
        );
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("inventory-images").getPublicUrl(filePath);

      setForm((current) => ({
        ...current,
        image_url: publicUrl,
      }));
    } catch (error) {
      console.error("Unexpected image upload error:", error);
      alert("Unexpected error uploading vehicle image.");
    } finally {
      setUploadingImage(false);
    }
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
      activity_type: "inventory",
      color,
      company_id: profile.company_id,
    });

    if (error) {
      console.error("Error saving inventory activity:", error.message);
    }
  }

  async function saveVehicle() {
    if (!profile?.company_id) return;

    if (!canEditInventory) {
      alert("Only Admin and Manager users can modify inventory.");
      return;
    }

    if (!form.make.trim() || !form.model.trim()) {
      alert("Please enter at least vehicle make and model.");
      return;
    }

    setSavingVehicle(true);

    const selectedLead =
      form.linked_lead_id !== ""
        ? leads.find((lead) => lead.id === Number(form.linked_lead_id))
        : null;

    const payload = {
      company_id: profile.company_id,
      stock_code: form.stock_code.trim() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      variant: form.variant.trim() || null,
      year: form.year ? Number(form.year) : null,
      mileage: form.mileage ? Number(form.mileage) : null,
      price: form.price ? Number(form.price) : null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      colour: form.colour.trim() || null,
      vin: form.vin.trim() || null,
      registration_number: form.registration_number.trim() || null,
      image_url: form.image_url.trim() || null,
      status: form.status || "Available",
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      linked_lead_id:
        form.linked_lead_id === "" ? null : Number(form.linked_lead_id),
      linked_customer_name: selectedLead?.customer || null,
    };

    if (editingVehicle) {
      const { error } = await supabase
        .from("inventory_vehicles")
        .update(payload)
        .eq("id", editingVehicle.id)
        .eq("company_id", profile.company_id);

      if (error) {
        alert("Error updating vehicle: " + error.message);
        setSavingVehicle(false);
        return;
      }

      await addLeadActivity(
        payload.linked_lead_id,
        "Vehicle Inventory Updated",
        `${payload.year || ""} ${payload.make || ""} ${payload.model || ""}${
          payload.stock_code ? ` • Stock ${payload.stock_code}` : ""
        } was updated in inventory.`,
        "blue"
      );
    } else {
      const { error } = await supabase
        .from("inventory_vehicles")
        .insert(payload);

      if (error) {
        alert("Error creating vehicle: " + error.message);
        setSavingVehicle(false);
        return;
      }

      await addLeadActivity(
        payload.linked_lead_id,
        "Vehicle Linked from Inventory",
        `${payload.year || ""} ${payload.make || ""} ${payload.model || ""}${
          payload.stock_code ? ` • Stock ${payload.stock_code}` : ""
        } was linked to this lead.`,
        "green"
      );
    }

    if (payload.linked_lead_id) {
      await supabase
        .from("leads")
        .update({
          vehicle: `${payload.year || ""} ${payload.make || ""} ${
            payload.model || ""
          } ${payload.variant || ""}`.trim(),
        })
        .eq("id", payload.linked_lead_id)
        .eq("company_id", profile.company_id);
    }

    setSavingVehicle(false);
    setShowVehicleModal(false);
    setEditingVehicle(null);
    setForm(emptyForm());

    fetchVehicles();
    fetchLeads();
  }

  const locations = useMemo(() => {
    const values = vehicles
      .map((vehicle) => vehicle.location)
      .filter((location): location is string => Boolean(location));

    return Array.from(new Set(values)).sort();
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    let result = vehicles.filter((vehicle) => {
      if (statusFilter !== "All Status" && vehicle.status !== statusFilter) {
        return false;
      }

      if (
        locationFilter !== "All Locations" &&
        vehicle.location !== locationFilter
      ) {
        return false;
      }

      if (!search) return true;

      const searchable = [
        vehicle.stock_code,
        vehicle.make,
        vehicle.model,
        vehicle.variant,
        vehicle.year,
        vehicle.colour,
        vehicle.vin,
        vehicle.registration_number,
        vehicle.linked_customer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });

    if (sortMode === "Price Low to High") {
      result = [...result].sort(
        (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)
      );
    }

    if (sortMode === "Price High to Low") {
      result = [...result].sort(
        (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0)
      );
    }

    if (sortMode === "Mileage Low to High") {
      result = [...result].sort(
        (a, b) => (Number(a.mileage) || 0) - (Number(b.mileage) || 0)
      );
    }

    return result;
  }, [vehicles, searchTerm, statusFilter, locationFilter, sortMode]);

  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "Available"
  ).length;
  const reservedVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "Reserved"
  ).length;
  const soldVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "Sold" || vehicle.status === "Delivered"
  ).length;

  const totalRetailValue = vehicles.reduce(
    (sum, vehicle) => sum + (Number(vehicle.price) || 0),
    0
  );

  return (
  <DashboardLayout>
    <PageAccessGuard module="inventory">
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-700">
                Vehicle stock
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                  Inventory
                </h1>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                  {totalVehicles} total
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {canEditInventory
                  ? "Manage vehicle stock, availability and lead links."
                  : "Browse current dealership inventory."}
              </p>

              {!canEditInventory && (
                <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  View only — inventory changes are managed by Admin or Manager
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Export
              </button>

              {canEditInventory && (
                <button
                  type="button"
                  onClick={openCreateVehicleModal}
                  className="rounded-2xl brand-primary-bg px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
                >
                  + Add Vehicle
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
        >
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Total Stock</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {totalVehicles}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Available</p>
            <h2 className="mt-1 text-2xl font-bold text-green-700">
              {availableVehicles}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Reserved</p>
            <h2 className="mt-1 text-2xl font-bold text-orange-700">
              {reservedVehicles}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Sold / Delivered</p>
            <h2 className="mt-1 text-2xl font-bold text-blue-700">
              {soldVehicles}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Retail Value</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {formatRand(totalRetailValue)}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 xl:grid-cols-[1fr_165px_165px_165px_150px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stock code, make, model, VIN, registration or customer..."
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option>All Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option>All Locations</option>
              {locations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option>Newest First</option>
              <option>Price Low to High</option>
              <option>Price High to Low</option>
              <option>Mileage Low to High</option>
            </select>

            <div className="flex rounded-xl border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  viewMode === "grid"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Grid
              </button>

              <button
                type="button"
                onClick={() => setViewMode("rows")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  viewMode === "rows"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Rows
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
            Loading inventory...
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">
              No vehicles found
            </h2>
            <p className="mt-2 text-slate-500">
              Add your first vehicle to start managing dealership stock.
            </p>
            {canEditInventory && (
              <button
                type="button"
                onClick={openCreateVehicleModal}
                className="mt-5 rounded-2xl brand-primary-bg px-5 py-3 text-sm font-semibold text-white"
              >
                + Add Vehicle
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))",
              alignItems: "start",
            }}
          >
            {filteredVehicles.map((vehicle) => {
              const title = vehicleTitle(vehicle);
              const subtitle = vehicleSubtitle(vehicle);

              return (
                <article
                  key={vehicle.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    style={{
                      width: "100%",
                      height: 155,
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: "16px 16px 0 0",
                      backgroundColor: "#f1f5f9",
                    }}
                  >
                    <VehiclePhoto
                      vehicle={vehicle}
                      title={title}
                      height={155}
                      width="100%"
                      rounded="16px 16px 0 0"
                    />

                    <span
                      className={statusBadge(vehicle.status)}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 30,
                        borderRadius: 999,
                        padding: "3px 9px",
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: "14px",
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.18)",
                      }}
                    >
                      {vehicle.status || "Available"}
                    </span>
                  </div>

                  <div className="p-4">
                    <h2 className="truncate text-sm font-bold text-slate-900">
                      {title || "Untitled Vehicle"}
                    </h2>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {subtitle || vehicle.stock_code || "Vehicle stock item"}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Mileage
                        </p>
                        <p className="truncate font-semibold text-slate-700">
                          {formatKm(vehicle.mileage)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Location
                        </p>
                        <p className="truncate font-semibold text-slate-700">
                          {vehicle.location || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xl font-extrabold text-slate-950">
                        {formatRand(vehicle.price)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Stock: {vehicle.stock_code || "-"}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        {vehicle.linked_lead_id ? (
                          <Link
                            href={`/leads/${vehicle.linked_lead_id}`}
                            className="block truncate text-xs font-semibold text-blue-700 hover:underline"
                            title="Open linked lead"
                          >
                            {vehicle.linked_customer_name ||
                              `Lead #${vehicle.linked_lead_id}`}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Not linked
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
  <Link
    href={`/inventory/${vehicle.id}`}
    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
  >
    View
  </Link>

  {canEditInventory && (
    <button
      type="button"
      onClick={() => openEditVehicleModal(vehicle)}
      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      Edit
    </button>
  )}
</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVehicles.map((vehicle) => {
              const title = vehicleTitle(vehicle);
              const subtitle = vehicleSubtitle(vehicle);
              const monthly = estimateMonthlyPayment(vehicle.price);

              return (
                <article
                  key={vehicle.id}
                  className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "170px minmax(260px, 1fr) 180px 190px 90px",
                      gap: 20,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ position: "relative", width: 170, height: 108 }}>
                      <VehiclePhoto
                        vehicle={vehicle}
                        title={title}
                        height={108}
                        width={170}
                        rounded="14px"
                      />

                      <span
                        className={statusBadge(vehicle.status)}
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          zIndex: 30,
                          borderRadius: 999,
                          padding: "3px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                          lineHeight: "14px",
                          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.18)",
                        }}
                      >
                        {vehicle.status || "Available"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-slate-900">
                        {title || "Untitled Vehicle"}
                      </h2>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {subtitle || "No variant captured"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>🚘 {formatKm(vehicle.mileage)}</span>
                        <span>📍 {vehicle.location || "-"}</span>
                        <span>Stock: {vehicle.stock_code || "-"}</span>
                        {vehicle.colour && <span>Colour: {vehicle.colour}</span>}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Retail Price
                      </p>
                      <p className="mt-1 text-xl font-extrabold text-slate-950">
                        {formatRand(vehicle.price)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {monthly ? `${formatRand(monthly)} p/m` : "Finance -"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Linked Lead
                      </p>

                      {vehicle.linked_lead_id ? (
                        <Link
                          href={`/leads/${vehicle.linked_lead_id}`}
                          className="mt-1 block truncate text-sm font-semibold text-blue-700 hover:underline"
                        >
                          {vehicle.linked_customer_name ||
                            `Lead #${vehicle.linked_lead_id}`}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">Not linked</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
  <Link
    href={`/inventory/${vehicle.id}`}
    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
  >
    View
  </Link>

  {canEditInventory && (
    <button
      type="button"
      onClick={() => openEditVehicleModal(vehicle)}
      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      Edit
    </button>
  )}
</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showVehicleModal && canEditInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-10 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {editingVehicle ? "Edit Vehicle" : "Add Vehicle"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Capture vehicle stock details, upload an image and optionally
                  link to a lead.
                </p>
              </div>

              <button
                onClick={() => setShowVehicleModal(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <VehiclePhoto
                  vehicle={{
                    id: 0,
                    company_id: null,
                    stock_code: form.stock_code,
                    make: form.make,
                    model: form.model,
                    variant: form.variant,
                    year: form.year ? Number(form.year) : null,
                    mileage: form.mileage ? Number(form.mileage) : null,
                    price: form.price ? Number(form.price) : null,
                    cost_price: form.cost_price ? Number(form.cost_price) : null,
                    colour: form.colour,
                    vin: form.vin,
                    registration_number: form.registration_number,
                    image_url: form.image_url,
                    status: form.status,
                    location: form.location,
                    notes: form.notes,
                    linked_lead_id: form.linked_lead_id
                      ? Number(form.linked_lead_id)
                      : null,
                    linked_customer_name: null,
                    created_at: null,
                  }}
                  title="Vehicle preview"
                  height={190}
                  width="100%"
                  rounded="16px"
                />

                <label className="mt-4 block cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500">
                  {uploadingImage ? "Uploading..." : "Upload Vehicle Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        await uploadVehicleImage(file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-600">
                    Or use Image URL
                  </label>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) =>
                      setForm({ ...form, image_url: e.target.value })
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-sm"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Uploaded image / URL shows first. If empty, the page uses a
                    make-based fallback image or a standard placeholder.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Stock Code
                  </label>
                  <input
                    type="text"
                    value={form.stock_code}
                    onChange={(e) =>
                      setForm({ ...form, stock_code: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Make
                  </label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) =>
                      setForm({ ...form, make: e.target.value })
                    }
                    placeholder="Volkswagen"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Model
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) =>
                      setForm({ ...form, model: e.target.value })
                    }
                    placeholder="Polo"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Variant
                  </label>
                  <input
                    type="text"
                    value={form.variant}
                    onChange={(e) =>
                      setForm({ ...form, variant: e.target.value })
                    }
                    placeholder="1.0 TSI Life"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Year
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) =>
                      setForm({ ...form, year: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Mileage
                  </label>
                  <input
                    type="number"
                    value={form.mileage}
                    onChange={(e) =>
                      setForm({ ...form, mileage: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Retail Price
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Colour
                  </label>
                  <input
                    type="text"
                    value={form.colour}
                    onChange={(e) =>
                      setForm({ ...form, colour: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={form.registration_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        registration_number: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    VIN
                  </label>
                  <input
                    type="text"
                    value={form.vin}
                    onChange={(e) => setForm({ ...form, vin: e.target.value })}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Location
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Main showroom"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600">
                    Link to Lead
                  </label>
                  <select
                    value={form.linked_lead_id}
                    onChange={(e) =>
                      setForm({ ...form, linked_lead_id: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">No lead selected</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        #{lead.id} • {lead.customer || "Unknown Customer"}
                        {lead.vehicle
                          ? ` • Current interest: ${lead.vehicle}`
                          : ""}
                      </option>
                    ))}
                  </select>
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
                    placeholder="Condition notes, recon requirements, extras..."
                    className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowVehicleModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveVehicle}
                disabled={savingVehicle || uploadingImage}
                className="rounded-2xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {savingVehicle ? "Saving..." : "Save Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}
          </PageAccessGuard>

    </DashboardLayout>
  );
}
