"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import PageAccessGuard from "@/components/PageAccessGuard";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

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

type InventoryVehicle = {
  id: number;
  stock_code: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  price: number | null;
  status: string | null;
};

type AssignableUser = {
  id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
};


const LEAD_SOURCE_OPTIONS = [
  "Walk-in",
  "Phone Call",
  "WhatsApp",
  "Facebook",
  "Instagram",
  "Website",
  "Referral",
  "Repeat Customer",
  "AutoTrader / Cars.co.za",
  "Finance Lead",
  "Other",
];

function vehicleDisplayName(vehicle: InventoryVehicle) {
  return `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${
    vehicle.variant || ""
  }`
    .replace(/\s+/g, " ")
    .trim();
}

export default function LeadsPage() {
  const { profile } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inventoryVehicles, setInventoryVehicles] = useState<InventoryVehicle[]>(
    []
  );
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLead, setSavingLead] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleSelection, setVehicleSelection] = useState("");
  const [otherVehicleInterest, setOtherVehicleInterest] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<number | "">("");
  const [budget, setBudget] = useState("");
  const [leadSource, setLeadSource] = useState("Walk-in");

  const canChooseSalesperson =
    profile?.role === "Admin" || profile?.role === "Manager";

  const selectedVehicle = useMemo(
    () =>
      inventoryVehicles.find(
        (vehicle) => String(vehicle.id) === vehicleSelection
      ) || null,
    [inventoryVehicles, vehicleSelection]
  );

  async function fetchLeads() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("id", { ascending: false });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading leads:", error.message);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  async function fetchInventoryVehicles() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("inventory_vehicles")
      .select("id, stock_code, make, model, variant, year, price, status")
      .eq("company_id", profile.company_id)
      .eq("status", "Available")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Error loading inventory vehicles:", error.message);
      setInventoryVehicles([]);
      return;
    }

    setInventoryVehicles(Array.isArray(data) ? data : []);
  }

  async function fetchAssignableUsers() {
    if (!profile?.company_id) return;

    if (!canChooseSalesperson) {
      setAssignableUsers([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", profile.company_id)
      .eq("status", "Active")
      .in("role", ["Sales", "Manager"])
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading salespeople:", error.message);
      setAssignableUsers([]);
      return;
    }

    setAssignableUsers(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!profile?.company_id) return;

    void Promise.all([
      fetchLeads(),
      fetchInventoryVehicles(),
      fetchAssignableUsers(),
    ]);
  }, [profile?.company_id, profile?.role, profile?.id]);

  function openAddLeadModal() {
    setCustomerName("");
    setPhone("");
    setEmail("");
    setVehicleSelection("");
    setOtherVehicleInterest("");
    setBudget("");
    setLeadSource("Walk-in");

    if (profile?.role === "Sales") {
      setAssignedUserId(profile.id);
    } else {
      setAssignedUserId("");
    }

    setShowAddModal(true);
  }

  function closeAddLeadModal() {
    if (savingLead) return;
    setShowAddModal(false);
  }

  async function saveLead() {
    if (!profile?.company_id || !profile?.id) return;

    if (!customerName.trim()) {
      alert("Please enter the customer name.");
      return;
    }

    if (!phone.trim()) {
      alert("Please enter the customer phone number.");
      return;
    }

    if (!vehicleSelection) {
      alert("Please select a vehicle interest.");
      return;
    }

    if (!leadSource.trim()) {
      alert("Please select the lead source.");
      return;
    }

    if (
      vehicleSelection === "other" &&
      !otherVehicleInterest.trim()
    ) {
      alert("Please describe the customer's vehicle interest.");
      return;
    }

    let selectedAssignee: AssignableUser | null = null;

    if (profile.role === "Sales") {
      selectedAssignee = {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      };
    } else {
      selectedAssignee =
        assignableUsers.find(
          (user) => user.id === Number(assignedUserId)
        ) || null;
    }

    if (!selectedAssignee) {
      alert("Please select the salesperson responsible for this lead.");
      return;
    }

    const vehicleInterest =
      vehicleSelection === "other"
        ? otherVehicleInterest.trim()
        : selectedVehicle
        ? vehicleDisplayName(selectedVehicle)
        : "";

    setSavingLead(true);

    const { data, error } = await supabase
      .from("leads")
      .insert({
        customer: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        vehicle: vehicleInterest,
        salesperson:
          selectedAssignee.full_name ||
          selectedAssignee.email ||
          "Unassigned",
        budget: budget.trim() || null,
        status: "New Lead",
        finance: "Not Submitted",
        source: leadSource.trim(),
        company_id: profile.company_id,
        assigned_user_id: selectedAssignee.id,
        assigned_user_name:
          selectedAssignee.full_name ||
          selectedAssignee.email ||
          "Unassigned",
      })
      .select("id")
      .single();

    setSavingLead(false);

    if (error || !data) {
      alert(
        "Error saving lead: " +
          (error?.message || "Unknown error")
      );
      return;
    }

    setShowAddModal(false);
    await fetchLeads();

    alert(`Lead #${data.id} created successfully.`);
  }

  return (
    <DashboardLayout>
      <PageAccessGuard module="leads">
        <ReadOnlyNotice />

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Leads
            </h1>

            <p className="text-slate-500">
              Manage dealership leads and follow-ups
            </p>
          </div>

          <WriteAccessGuard>
            <button
              type="button"
              onClick={openAddLeadModal}
              className="rounded-lg brand-primary-bg px-5 py-3 text-white"
            >
              + Add Lead
            </button>
          </WriteAccessGuard>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          {loading ? (
            <div className="p-6 text-slate-500">
              Loading leads...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Vehicle
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Salesperson
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Finance
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {lead.customer}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {lead.vehicle || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                          {lead.status || "New Lead"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {lead.assigned_user_name ||
                          lead.salesperson ||
                          "Unassigned"}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                          {lead.finance || "Not Submitted"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="rounded-lg brand-primary-bg px-4 py-2 text-sm text-white"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {leads.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        No leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-slate-800">
                Add New Lead
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select an available stock vehicle or choose Other.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Customer Name
                  </label>

                  <input
                    type="text"
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Phone Number
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Email
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Lead Source
                  </label>

                  <select
                    value={leadSource}
                    onChange={(event) =>
                      setLeadSource(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
                  >
                    {LEAD_SOURCE_OPTIONS.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-slate-500">
                    Capture this properly for dealership source reporting.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Vehicle Interest
                  </label>

                  <select
                    value={vehicleSelection}
                    onChange={(event) =>
                      setVehicleSelection(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
                  >
                    <option value="">
                      Select an available vehicle...
                    </option>

                    {inventoryVehicles.map((vehicle) => (
                      <option
                        key={vehicle.id}
                        value={vehicle.id}
                      >
                        {vehicle.stock_code
                          ? `${vehicle.stock_code} • `
                          : ""}
                        {vehicleDisplayName(vehicle)}
                        {vehicle.price
                          ? ` • R ${Number(
                              vehicle.price
                            ).toLocaleString("en-ZA")}`
                          : ""}
                      </option>
                    ))}

                    <option value="other">
                      Other / Not currently in stock
                    </option>
                  </select>
                </div>

                {vehicleSelection === "other" && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Other Vehicle Interest
                    </label>

                    <input
                      type="text"
                      value={otherVehicleInterest}
                      onChange={(event) =>
                        setOtherVehicleInterest(
                          event.target.value
                        )
                      }
                      placeholder="Example: 2023 Toyota Fortuner"
                      className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Salesperson
                  </label>

                  {canChooseSalesperson ? (
                    <select
                      value={assignedUserId}
                      onChange={(event) =>
                        setAssignedUserId(
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                      <option value="">
                        Select salesperson...
                      </option>

                      {assignableUsers.map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.full_name || user.email}
                          {user.role ? ` (${user.role})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-700">
                      {profile?.full_name ||
                        profile?.email ||
                        "Current Sales User"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Budget
                  </label>

                  <input
                    type="text"
                    value={budget}
                    onChange={(event) =>
                      setBudget(event.target.value)
                    }
                    placeholder="Example: R8,500 per month"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddLeadModal}
                  disabled={savingLead}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void saveLead()}
                  disabled={savingLead}
                  className="rounded-lg brand-primary-bg px-4 py-2 text-white disabled:opacity-50"
                >
                  {savingLead ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageAccessGuard>
    </DashboardLayout>
  );
}
