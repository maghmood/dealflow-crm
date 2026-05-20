"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type DocumentItem = {
  id: number;
  lead_id: number | null;
  customer_name: string | null;
  document_name: string | null;
  document_type: string | null;
  file_url: string | null;
  status: string | null;
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
];

export default function DocumentsPage() {
  const { profile } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !profile?.company_id) return;

    setUploading(true);

    try {
      const filePath = `${profile.company_id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("finance-documents")
        .upload(filePath, file);

      if (uploadError) {
        alert(uploadError.message);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("finance-documents")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("finance_documents")
        .insert({
          company_id: profile.company_id,
          customer_name: "Unlinked Customer",
          document_name: file.name,
          document_type: "Contract",
          file_url: publicUrl,
          status: "Pending",
          uploaded_by_name: profile.full_name,
        });

      if (insertError) {
        alert(insertError.message);
      } else {
        fetchDocuments();
      }
    } catch (err) {
      console.error(err);
    }

    setUploading(false);
  }

  const filteredDocuments = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        (doc.customer_name || "")
          .toLowerCase()
          .includes(search) ||
        (doc.document_name || "")
          .toLowerCase()
          .includes(search) ||
        (doc.document_type || "")
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "All" ||
        (doc.status || "Pending") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [documents, searchTerm, statusFilter]);

  const pendingCount = documents.filter(
    (d) => d.status === "Pending"
  ).length;

  const approvedCount = documents.filter(
    (d) => d.status === "Approved"
  ).length;

  const rejectedCount = documents.filter(
    (d) => d.status === "Rejected"
  ).length;

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Documents
            </h1>

            <p className="text-slate-500">
              Finance and dealership document management
            </p>
          </div>

          <label
            className="cursor-pointer rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {uploading ? "Uploading..." : "+ Upload Document"}

            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Documents
            </p>

            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {documents.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Pending Review
            </p>

            <h2 className="mt-2 text-3xl font-bold text-yellow-700">
              {pendingCount}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Approved
            </p>

            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {approvedCount}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Rejected
            </p>

            <h2 className="mt-2 text-3xl font-bold text-red-700">
              {rejectedCount}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <input
              type="text"
              placeholder="Search customer, document or type..."
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
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-slate-500">
              Loading documents...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
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
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {doc.document_name}
                          </p>

                          <p className="text-sm text-slate-500">
                            Lead #{doc.lead_id || "-"}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {doc.customer_name || "-"}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {doc.document_type || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(
                            doc.status
                          )}`}
                        >
                          {doc.status || "Pending"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {doc.uploaded_by_name || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {doc.created_at
                          ? new Date(
                              doc.created_at
                            ).toLocaleDateString("en-ZA")
                          : "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              className="rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700 hover:bg-blue-200"
                            >
                              View
                            </a>
                          )}

                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              download
                              className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700 hover:bg-green-200"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredDocuments.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
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
    </DashboardLayout>
  );
}