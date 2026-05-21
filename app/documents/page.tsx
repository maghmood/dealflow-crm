"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import WriteAccessGuard from "@/components/WriteAccessGuard";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type DocumentItem = {
  id: number;
  company_id: number | null;
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

const DOCUMENT_TYPES = [
  "ID Copy",
  "Payslip",
  "Bank Statement",
  "Proof of Address",
  "Driver License",
  "Settlement Letter",
  "Trade-In Docs",
  "Signed OTP",
  "Contract",
  "Invoice",
  "Delivery Handover",
  "Other",
];

function getFileNameFromUrl(fileUrl: string | null) {
  if (!fileUrl) return "Document file";

  try {
    const url = new URL(fileUrl);
    const lastPart = url.pathname.split("/").pop();
    return lastPart ? decodeURIComponent(lastPart) : "Document file";
  } catch {
    const lastPart = fileUrl.split("/").pop();
    return lastPart || "Document file";
  }
}

function linkedType(doc: DocumentItem) {
  if (doc.deal_id) return "Deal";
  if (doc.lead_id) return "Lead";
  if (doc.vehicle_id) return "Vehicle";
  return "Unlinked";
}

function linkedBadgeClass(type: string) {
  const styles: Record<string, string> = {
    Deal: "bg-green-100 text-green-700",
    Lead: "bg-blue-100 text-blue-700",
    Vehicle: "bg-purple-100 text-purple-700",
    Unlinked: "bg-slate-100 text-slate-700",
  };

  return styles[type] || "bg-slate-100 text-slate-700";
}

function statusBadge(status: string | null) {
  const value = status || "Pending";

  const styles: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Expired: "bg-slate-200 text-slate-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

export default function DocumentsPage() {
  const { profile } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [linkFilter, setLinkFilter] = useState("All Links");
  const [documentType, setDocumentType] = useState("Contract");

  const [uploading, setUploading] = useState(false);

  async function fetchDocuments() {
    if (!profile?.company_id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("finance_documents")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading documents:", error.message);
      setDocuments([]);
    } else {
      setDocuments(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchDocuments();
  }, [profile?.company_id]);

  async function openSecureDocument(
    documentId: number,
    mode: "view" | "download"
  ) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        return;
      }

      const response = await fetch(
        `/api/documents/${documentId}/signed-url?mode=${mode}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.signedUrl) {
        alert(result.error || "Could not open document.");
        return;
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert("Unexpected error opening document.");
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !profile?.company_id) return;

    setUploading(true);

    try {
      const fileExt = file.name.includes(".")
        ? file.name.split(".").pop()
        : "file";

      const safeDocType = documentType
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

      const filePath = `${profile.company_id}/unlinked/${safeDocType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("finance-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        alert(uploadError.message);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("finance-documents").getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("finance_documents")
        .insert({
          company_id: profile.company_id,
          customer_name: "Unlinked Customer",
          document_name: file.name,
          document_type: documentType,
          file_url: publicUrl,
          status: "Pending",
          uploaded_by: profile.full_name || profile.email || "Unknown User",
          uploaded_by_name:
            profile.full_name || profile.email || "Unknown User",
        });

      if (insertError) {
        alert(insertError.message);
      } else {
        await fetchDocuments();
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error uploading document.");
    }

    setUploading(false);
  }

  const filteredDocuments = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return documents.filter((doc) => {
      const type = linkedType(doc);

      const matchesSearch =
        (doc.customer_name || "").toLowerCase().includes(search) ||
        (doc.document_name || "").toLowerCase().includes(search) ||
        (doc.document_type || "").toLowerCase().includes(search) ||
        String(doc.lead_id || "").includes(search) ||
        String(doc.deal_id || "").includes(search) ||
        String(doc.vehicle_id || "").includes(search);

      const matchesStatus =
        statusFilter === "All" || (doc.status || "Pending") === statusFilter;

      const matchesLink = linkFilter === "All Links" || linkFilter === type;

      return matchesSearch && matchesStatus && matchesLink;
    });
  }, [documents, searchTerm, statusFilter, linkFilter]);

  const pendingCount = documents.filter(
    (d) => (d.status || "Pending") === "Pending"
  ).length;

  const approvedCount = documents.filter(
    (d) => d.status === "Approved"
  ).length;

  const rejectedCount = documents.filter(
    (d) => d.status === "Rejected"
  ).length;

  const dealDocsCount = documents.filter((d) => d.deal_id).length;
  const leadDocsCount = documents.filter((d) => d.lead_id).length;
  const vehicleDocsCount = documents.filter((d) => d.vehicle_id).length;

  return (
  <DashboardLayout>
    <PageAccessGuard module="documents">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Documents</h1>

            <p className="text-slate-500">
              Finance, lead, deal and dealership document management
            </p>
          </div>

                    <WriteAccessGuard>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>

              <label
                className="cursor-pointer rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {uploading ? "Uploading..." : "+ Upload Unlinked Document"}

                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    await handleUpload(e);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </WriteAccessGuard>
        </div>

        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <MetricCard label="Total Documents" value={documents.length} />
          <MetricCard
            label="Pending Review"
            value={pendingCount}
            color="yellow"
          />
          <MetricCard label="Approved" value={approvedCount} color="green" />
          <MetricCard label="Rejected" value={rejectedCount} color="red" />
          <MetricCard label="Deal Docs" value={dealDocsCount} color="green" />
          <MetricCard label="Lead Docs" value={leadDocsCount} color="blue" />
          <MetricCard
            label="Vehicle Docs"
            value={vehicleDocsCount}
            color="purple"
          />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
            <input
              type="text"
              placeholder="Search customer, document, type, lead #, deal # or vehicle #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
            </select>

            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option>All Links</option>
              <option>Deal</option>
              <option>Lead</option>
              <option>Vehicle</option>
              <option>Unlinked</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="p-6 text-slate-500">Loading documents...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1380px] table-fixed">
                <colgroup>
                  <col className="w-[285px]" />
                  <col className="w-[190px]" />
                  <col className="w-[155px]" />
                  <col className="w-[320px]" />
                  <col className="w-[130px]" />
                  <col className="w-[180px]" />
                  <col className="w-[140px]" />
                  <col className="w-[180px]" />
                </colgroup>

                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Document
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Type
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      CRM Links
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Uploaded By
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Uploaded
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map((doc) => {
                    const type = linkedType(doc);

                    return (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                      >
                        <td className="px-6 py-5">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold leading-5 text-slate-900">
                              {doc.document_name ||
                                getFileNameFromUrl(doc.file_url)}
                            </p>

                            <p className="mt-2 text-xs font-medium text-slate-400">
                              Document #{doc.id}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <p className="break-words text-sm font-medium text-slate-700">
                            {doc.customer_name || "-"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="break-words text-sm text-slate-700">
                            {doc.document_type || "-"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                Linked Records
                              </span>

                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${linkedBadgeClass(
                                  type
                                )}`}
                              >
                                {type}
                              </span>
                            </div>

                            <div className="grid gap-2">
                              {doc.deal_id && (
                                <Link
                                  href={`/deals/${doc.deal_id}`}
                                  className="flex items-center justify-between rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-50"
                                >
                                  <span>Deal</span>
                                  <span>#{doc.deal_id}</span>
                                </Link>
                              )}

                              {doc.lead_id && (
                                <Link
                                  href={`/leads/${doc.lead_id}`}
                                  className="flex items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                                >
                                  <span>Lead</span>
                                  <span>#{doc.lead_id}</span>
                                </Link>
                              )}

                              {doc.vehicle_id && (
                                <Link
                                  href={`/inventory/${doc.vehicle_id}`}
                                  className="flex items-center justify-between rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50"
                                >
                                  <span>Vehicle</span>
                                  <span>#{doc.vehicle_id}</span>
                                </Link>
                              )}

                              {!doc.deal_id &&
                                !doc.lead_id &&
                                !doc.vehicle_id && (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-400">
                                    No CRM link
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${statusBadge(
                              doc.status
                            )}`}
                          >
                            {doc.status || "Pending"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <p className="break-words text-sm text-slate-700">
                            {doc.uploaded_by_name || doc.uploaded_by || "-"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm text-slate-500">
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleDateString(
                                  "en-ZA"
                                )
                              : "-"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                                                        {doc.file_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  openSecureDocument(doc.id, "view")
                                }
                                className="rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                              >
                                View
                              </button>
                            )}

                            {doc.file_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  openSecureDocument(doc.id, "download")
                                }
                                className="rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200"
                              >
                                Download
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDocuments.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        No documents found.
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

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "yellow" | "green" | "red" | "blue" | "purple";
}) {
  const colorClass =
    color === "yellow"
      ? "text-yellow-700"
      : color === "green"
      ? "text-green-700"
      : color === "red"
      ? "text-red-700"
      : color === "blue"
      ? "text-blue-700"
      : color === "purple"
      ? "text-purple-700"
      : "text-slate-900";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>

      <h2 className={`mt-2 text-3xl font-bold ${colorClass}`}>{value}</h2>
    </div>
  );
}