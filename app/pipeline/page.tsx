"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type Lead = {
  id: number;
  customer: string | null;
  vehicle: string | null;
  vehicle_interest: string | null;
  status: string | null;
  assigned_user_name: string | null;
  created_at: string | null;
  assigned_user_id: number | null;
};

const PIPELINE_COLUMNS = [
  { status: "New Lead", color: "border-blue-500", bg: "bg-blue-50", dot: "bg-blue-500" },
  { status: "Contacted", color: "border-cyan-500", bg: "bg-cyan-50", dot: "bg-cyan-500" },
  { status: "Qualified", color: "border-green-500", bg: "bg-green-50", dot: "bg-green-500" },
  { status: "Test Drive", color: "border-yellow-500", bg: "bg-yellow-50", dot: "bg-yellow-500" },
  { status: "Negotiation", color: "border-orange-500", bg: "bg-orange-50", dot: "bg-orange-500" },
  { status: "Finance", color: "border-purple-500", bg: "bg-purple-50", dot: "bg-purple-500" },
  { status: "Approved", color: "border-teal-500", bg: "bg-teal-50", dot: "bg-teal-500" },
  { status: "Delivered", color: "border-sky-500", bg: "bg-sky-50", dot: "bg-sky-500" },
  { status: "Lost", color: "border-red-500", bg: "bg-red-50", dot: "bg-red-500" },
];

export default function PipelinePage() {
  const { profile } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  async function fetchLeads() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading pipeline:", error.message);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchLeads();
  }, [profile?.company_id, profile?.role, profile?.id]);

  const filteredLeads = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return leads.filter((lead) => {
      return (
        (lead.customer || "").toLowerCase().includes(search) ||
        (lead.vehicle || "").toLowerCase().includes(search) ||
        (lead.vehicle_interest || "").toLowerCase().includes(search) ||
        (lead.assigned_user_name || "").toLowerCase().includes(search)
      );
    });
  }, [leads, searchTerm]);

  const groupedLeads = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};

    PIPELINE_COLUMNS.forEach((column) => {
      grouped[column.status] = [];
    });

    filteredLeads.forEach((lead) => {
      const status = lead.status || "New Lead";

      if (!grouped[status]) {
        grouped[status] = [];
      }

      grouped[status].push(lead);
    });

    return grouped;
  }, [filteredLeads]);

  const totalLeads = filteredLeads.length;
  const activeLeads = filteredLeads.filter(
    (lead) =>
      lead.status !== "Delivered" &&
      lead.status !== "Lost"
  ).length;
  const financeLeads = groupedLeads["Finance"]?.length || 0;
  const approvedLeads = groupedLeads["Approved"]?.length || 0;

  return (
  <DashboardLayout>
    <PageAccessGuard module="pipeline">
      
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Sales Pipeline
            </h1>
            <p className="text-slate-500">
              Visual dealership lead workflow management
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Search leads, vehicles or salesperson..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm sm:w-96"
            />

            <Link
              href="/leads"
              className="rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              + Add / View Leads
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Pipeline</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {totalLeads}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active Leads</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-700">
              {activeLeads}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">In Finance</p>
            <h2 className="mt-2 text-3xl font-bold text-purple-700">
              {financeLeads}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Approved</p>
            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {approvedLeads}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 shadow-sm">
            <p className="text-slate-500">Loading pipeline...</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="flex min-h-[680px] gap-5">
              {PIPELINE_COLUMNS.map((column) => {
                const columnLeads = groupedLeads[column.status] || [];

                return (
                  <div
                    key={column.status}
                    className={`flex w-[310px] flex-shrink-0 flex-col rounded-2xl border-t-4 ${column.color} bg-white shadow-sm`}
                  >
                    <div className={`${column.bg} rounded-t-2xl p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-3 w-3 rounded-full ${column.dot}`}
                            />
                            <h2 className="font-bold text-slate-800">
                              {column.status}
                            </h2>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {columnLeads.length} leads
                          </p>
                        </div>

                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                          {columnLeads.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 bg-slate-50/70 p-4">
                      {columnLeads.length === 0 ? (
                        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-400">
                          No leads in this stage
                        </div>
                      ) : (
                        columnLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-slate-800">
                                  {lead.customer || "Unnamed Customer"}
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                  {lead.vehicle ||
                                    lead.vehicle_interest ||
                                    "No vehicle selected"}
                                </p>
                              </div>

                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                #{lead.id}
                              </span>
                            </div>

                            <div className="mt-4 space-y-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Assigned To
                                </p>
                                <p className="text-sm font-medium text-slate-700">
                                  {lead.assigned_user_name || "Unassigned"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Created
                                </p>
                                <p className="text-sm text-slate-600">
                                  {lead.created_at
                                    ? new Date(
                                        lead.created_at
                                      ).toLocaleDateString("en-ZA")
                                    : "-"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="block rounded-lg bg-slate-900 px-4 py-2 text-center text-sm text-white transition hover:bg-slate-700"
                              >
                                Open Lead
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
          </PageAccessGuard>

    </DashboardLayout>
  );
}