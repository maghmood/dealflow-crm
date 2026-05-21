"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  company_id: number | null;
  created_at: string | null;
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
    "Test Drive Booked": "bg-yellow-100 text-yellow-700",
    "Deal Closed": "bg-green-100 text-green-700",
    Interested: "bg-green-100 text-green-700",
    "Follow Up": "bg-slate-100 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

export default function CustomersPage() {
  const { profile } = useAuth();

  const [customers, setCustomers] = useState<LeadCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function fetchCustomers() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("leads")
      .select(
        "id, customer, phone, email, vehicle, status, assigned_user_id, assigned_user_name, company_id, created_at"
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading customers:", error.message);
      setCustomers([]);
    } else {
      setCustomers(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchCustomers();
  }, [profile?.company_id, profile?.role, profile?.id]);

  const filteredCustomers = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return customers.filter((item) => {
      const matchesSearch =
        (item.customer || "").toLowerCase().includes(search) ||
        (item.phone || "").toLowerCase().includes(search) ||
        (item.email || "").toLowerCase().includes(search) ||
        (item.vehicle || "").toLowerCase().includes(search) ||
        (item.assigned_user_name || "").toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" || (item.status || "New Lead") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  const uniqueEmailCount = new Set(
    customers.map((c) => c.email).filter(Boolean)
  ).size;

  const activeCustomerCount = customers.filter(
    (c) => c.status !== "Lost" && c.status !== "Delivered"
  ).length;

  const deliveredCount = customers.filter(
    (c) => c.status === "Delivered"
  ).length;

  const pipelineCount = customers.filter(
    (c) => c.status !== "Lost" && c.status !== "Delivered"
  ).length;

  const statuses = Array.from(
    new Set(customers.map((c) => c.status || "New Lead"))
  );

  return (
  <DashboardLayout>
    <PageAccessGuard module="customers">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Customers</h1>
            <p className="text-slate-500">
              Customer directory generated from dealership leads
            </p>
          </div>

          <div className="flex gap-3">
            <button className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Import
            </button>

            <Link
              href="/leads"
              className="rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              + Add Customer via Lead
            </Link>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Customer Records",
              customers.length,
              "All time",
              "bg-purple-100",
              "👥",
              "text-slate-900",
            ],
            [
              "Unique Emails",
              uniqueEmailCount,
              "All time",
              "bg-blue-100",
              "✉️",
              "text-blue-700",
            ],
            [
              "Active Customers",
              activeCustomerCount,
              "Not lost or delivered",
              "bg-green-100",
              "✅",
              "text-green-700",
            ],
            [
              "Leads in Pipeline",
              pipelineCount,
              "Still progressing",
              "bg-orange-100",
              "🔎",
              "text-orange-700",
            ],
            [
              "Delivered",
              deliveredCount,
              "Successful sales",
              "bg-teal-100",
              "✔️",
              "text-teal-700",
            ],
          ].map(([label, value, sub, bg, icon, color]) => (
            <div
              key={String(label)}
              className="min-w-0 rounded-2xl bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-500">{label}</p>

                  <h2 className={`mt-2 text-3xl font-bold ${color}`}>
                    {String(value)}
                  </h2>

                  <p className="mt-2 truncate text-xs text-slate-400">{sub}</p>
                </div>

                <div
                  className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${bg} text-2xl`}
                >
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              [
                "WhatsApp",
                "Send message",
                "🟢",
                "bg-green-100",
                "hover:bg-green-50",
              ],
              ["Email", "Send email", "✉️", "bg-blue-100", "hover:bg-blue-50"],
              ["Call", "Log call", "📞", "bg-purple-100", "hover:bg-purple-50"],
              [
                "Upsell / Cross-sell",
                "Suggest vehicles",
                "🏷️",
                "bg-orange-100",
                "hover:bg-orange-50",
              ],
              [
                "Schedule",
                "Book appointment",
                "📅",
                "bg-teal-100",
                "hover:bg-teal-50",
              ],
              ["More", "More actions", "⋯", "bg-slate-100", "hover:bg-slate-50"],
            ].map(([title, sub, icon, bg, hover]) => (
              <button
                key={String(title)}
                className={`flex items-center gap-4 rounded-xl p-4 text-left ${hover}`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${bg} text-xl`}
                >
                  {icon}
                </span>

                <span>
                  <p className="font-semibold text-slate-800">{title}</p>
                  <p className="text-sm text-slate-500">{sub}</p>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Search customer, phone, email, vehicle or salesperson..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm lg:col-span-2"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="All">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Filters
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="p-6 text-slate-500">Loading customers...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Vehicle Interest
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Assigned To
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Added
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                            {getInitials(item.customer)}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.customer || "Unnamed Customer"}
                            </p>
                            <p className="text-sm text-slate-500">
                              Lead #{item.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-slate-700">{item.phone || "-"}</p>
                        <p className="text-sm text-slate-500">
                          {item.email || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {item.vehicle || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(
                            item.status
                          )}`}
                        >
                          {item.status || "New Lead"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {getInitials(item.assigned_user_name)}
                          </div>
                          <span className="text-sm text-slate-700">
                            {item.assigned_user_name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString(
                              "en-ZA"
                            )
                          : "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/customers/${item.id}`}
                            className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                          >
                            View 360
                          </Link>

                          <Link
                            href={`/leads/${item.id}`}
                            className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                          >
                            Open Lead
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

          </PageAccessGuard>

    </DashboardLayout>
  );
}