"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { canAccessRole } from "@/lib/auth";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

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

export default function LeadsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
const { profile } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleInterest, setVehicleInterest] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [budget, setBudget] = useState("");

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
  } else {
    setLeads(data || []);
  }

  setLoading(false);
}

  useEffect(() => {
  if (!profile?.company_id) return;

  fetchLeads();
}, [profile?.company_id, profile?.role, profile?.id]);

  async function saveLead() {
    const { error } = await supabase.from("leads").insert({
      customer: customerName,
      phone: phone,
      vehicle: vehicleInterest,
      salesperson: salesperson,
      budget: budget,
      status: "New Lead",
      finance: "Not Submitted",
      source: "Manual",
      company_id: profile?.company_id,
assigned_user_id: profile?.id,
assigned_user_name: profile?.full_name,
    });

    if (error) {
      alert("Error saving lead: " + error.message);
      return;
    }

    setShowAddModal(false);
    setCustomerName("");
    setPhone("");
    setVehicleInterest("");
    setSalesperson("");
    setBudget("");

    fetchLeads();
  }

  return (
  <DashboardLayout>
    <PageAccessGuard module="leads">
      <ReadOnlyNotice />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Leads</h1>
          <p className="text-slate-500">
            Manage dealership leads and follow-ups
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg brand-primary-bg px-5 py-3 text-white"
        >
          + Add Lead
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        {loading ? (
          <div className="p-6 text-slate-500">Loading leads...</div>
        ) : (
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
                <tr key={lead.id} className="border-t hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {lead.customer}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {lead.vehicle}
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                      {lead.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {lead.salesperson}
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                      {lead.finance}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <a
                      href={`/leads/${lead.id}`}
                      className="rounded-lg brand-primary-bg px-4 py-2 text-sm text-white"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Add New Lead
            </h2>

            <div className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <input
                type="text"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <input
                type="text"
                placeholder="Vehicle Interest"
                value={vehicleInterest}
                onChange={(e) => setVehicleInterest(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <input
                type="text"
                placeholder="Salesperson"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />

              <input
                type="text"
                placeholder="Budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={saveLead}
                className="rounded-lg brand-primary-bg px-4 py-2 text-white"
              >
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}
          </PageAccessGuard>

    </DashboardLayout>
  );
}