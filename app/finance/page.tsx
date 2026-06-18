"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

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

export default function FinancePage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<FinanceApplication[]>([]);
  const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState("All");
const [sortOrder, setSortOrder] = useState("Newest");
  const [selectedApp, setSelectedApp] = useState<FinanceApplication | null>(
    null
  );
  const [bank, setBank] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");

  async function fetchApplications() {
    setLoading(true);

    const { data, error } = await supabase
  .from("finance_applications")
  .select("*")
  .eq("company_id", profile?.company_id)
  .order("id", { ascending: false });

    if (error) {
      console.error("Error loading finance applications:", error.message);
    } else {
      setApplications(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
  if (!profile?.company_id) return;

  fetchApplications();
}, [profile?.company_id]);

  function openReviewModal(app: FinanceApplication) {
    setSelectedApp(app);
    setBank(app.bank || "");
    setFinanceNotes(app.finance_notes || "");
  }

  function statusClass(status: string | null) {
    if (status === "Approved") return "bg-green-100 text-green-700";
    if (status === "Declined") return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  }

  async function updateFinanceStatus(newStatus: string) {
    if (!selectedApp) return;

    const { error } = await supabase
      .from("finance_applications")
      .update({
        finance_status: newStatus,
        bank: bank,
        finance_notes: financeNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedApp.id);

    if (error) {
      alert("Error updating finance application: " + error.message);
      return;
    }

if (selectedApp.lead_id) {
  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({
      finance: newStatus,
    })
    .eq("id", selectedApp.lead_id);

  if (leadUpdateError) {
    alert("Finance updated, but lead finance status failed: " + leadUpdateError.message);
    return;
  }
}

    if (selectedApp.lead_id) {
      await supabase.from("lead_activities").insert({
        lead_id: selectedApp.lead_id,
        title: `Finance ${newStatus}`,
        description:
          financeNotes ||
          `Finance application was updated to ${newStatus}.`,
        activity_type: "Finance",
        color:
          newStatus === "Approved"
            ? "green"
            : newStatus === "Declined"
            ? "red"
            : "orange",
      });
    }

    setSelectedApp(null);
    fetchApplications();
  }

const filteredApplications = applications
  .filter((app) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      (app.customer || "").toLowerCase().includes(search) ||
      (app.vehicle || "").toLowerCase().includes(search) ||
      (app.bank || "").toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "All" ||
      (app.finance_status || "Submitted") === statusFilter;

    return matchesSearch && matchesStatus;
  })
  .sort((a, b) => {
    if (sortOrder === "Oldest") {
      return Number(a.id) - Number(b.id);
    }

    return Number(b.id) - Number(a.id);
  });



  return (
  <DashboardLayout>
    <PageAccessGuard module="finance">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-700">
            Finance workflow
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Finance Queue
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review applications, monitor approvals and keep the sales team updated on finance progress.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Applications</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {applications.length}
          </h2>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Approved</p>
          <h2 className="mt-2 text-3xl font-bold text-green-700">
            {applications.filter((a) => a.finance_status === "Approved").length}
          </h2>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Pending Review</p>
          <h2 className="mt-2 text-3xl font-bold text-orange-700">
            {
              applications.filter(
                (a) => a.finance_status === "Submitted" || !a.finance_status
              ).length
            }
          </h2>
        </div>
      </div>

<div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <input
      type="text"
      placeholder="Search customer, vehicle or bank..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />

    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    >
      <option value="All">All Statuses</option>
      <option value="Submitted">Submitted</option>
      <option value="Approved">Approved</option>
      <option value="Declined">Declined</option>
    </select>

    <select
      value={sortOrder}
      onChange={(e) => setSortOrder(e.target.value)}
      className="rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    >
      <option value="Newest">Newest First</option>
      <option value="Oldest">Oldest First</option>
    </select>
  </div>
</div>


      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-slate-500">
            Loading finance applications...
          </div>
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
                  Requested Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Bank
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredApplications.map((app) => (
                <tr key={app.id} className="border-t hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {app.customer}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {app.vehicle}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    R {Number(app.requested_amount || 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${statusClass(
                        app.finance_status
                      )}`}
                    >
                      {app.finance_status || "Submitted"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {app.bank || "-"}
                  </td>

                  <td className="px-6 py-4">
                    <Link
  href={`/finance/${app.id}`}
  className="rounded-2xl brand-primary-bg px-4 py-2 text-sm text-white"
>
  View
</Link>
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
  <tr>
    <td
      colSpan={6}
      className="px-6 py-10 text-center text-slate-500"
    >
      No finance applications found
    </td>
  </tr>
)}
            </tbody>
          </table>
        )}
      </div>

      {selectedApp && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Review Finance Application
            </h2>

            <p className="mt-1 text-slate-500">
              {selectedApp.customer} — {selectedApp.vehicle}
            </p>

            <div className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Bank / Finance Provider"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <textarea
                placeholder="Finance notes"
                value={financeNotes}
                onChange={(e) => setFinanceNotes(e.target.value)}
                className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <WriteAccessGuard>

              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-lg border border-slate-300 px-4 py-2"
              >
                Cancel
              </button></WriteAccessGuard>
              <WriteAccessGuard>

              <button
                onClick={() => updateFinanceStatus("Submitted")}
                className="rounded-lg bg-orange-100 px-4 py-2 text-orange-700 hover:bg-orange-200"
              >
                Pending
              </button></WriteAccessGuard>

              <WriteAccessGuard><button
                onClick={() => updateFinanceStatus("Declined")}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Decline
              </button></WriteAccessGuard>

              <WriteAccessGuard><button
                onClick={() => updateFinanceStatus("Approved")}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Approve
              </button></WriteAccessGuard>
            </div>
          </div>
        </div>
      )}
          </PageAccessGuard>

    </DashboardLayout>
  );
}