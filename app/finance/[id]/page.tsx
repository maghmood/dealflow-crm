"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type FinanceDocument = {
  id: number;
  finance_application_id: number;
  lead_id: number | null;
  document_name: string;
  document_type: string | null;
  file_path: string;
  uploaded_by: string | null;
  created_at: string;
};

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

type FinanceNote = {
  id: number;
  finance_application_id: number;
  lead_id: number | null;
  note: string;
  created_by: string | null;
  created_at: string;
};

type Activity = {
  id: number;
  title: string | null;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string | null;
};

export default function FinanceDetailPage() {
  const { profile } = useAuth();
  const params = useParams();
  const financeId = params.id as string;
const [financeDocuments, setFinanceDocuments] = useState<FinanceDocument[]>([]);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [documentType, setDocumentType] = useState("ID Document");
  const [application, setApplication] =
    useState<FinanceApplication | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [bank, setBank] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");
const [financeNotesHistory, setFinanceNotesHistory] = useState<FinanceNote[]>([]);
const [newFinanceNote, setNewFinanceNote] = useState("");

async function fetchFinanceNotes() {
  const { data, error } = await supabase
    .from("finance_notes")
    .select("*")
    .eq("finance_application_id", financeId)
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading finance notes:", error.message);
    setFinanceNotesHistory([]);
    return;
  }

  setFinanceNotesHistory(Array.isArray(data) ? data : []);
}

async function fetchFinanceDocuments() {
  const { data, error } = await supabase
    .from("finance_documents")
    .select("*")
    .eq("finance_application_id", financeId)
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading finance documents:", error.message);
  } else {
    setFinanceDocuments(data || []);
  }
}

async function addFinanceNote() {
  if (!application || !newFinanceNote.trim()) return;

  const { error } = await supabase.from("finance_notes").insert({
    finance_application_id: application.id,
      company_id: profile?.company_id,
    lead_id: application.lead_id,
    note: newFinanceNote,
    created_by: "Finance User",
  });

  if (error) {
    alert("Error saving finance note: " + error.message);
    return;
  }

  if (application.lead_id) {
    await supabase.from("lead_activities").insert({
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      title: "Finance Note Added",
      description: newFinanceNote,
      activity_type: "Finance",
      color: "orange",
    });
  }

  setNewFinanceNote("");
  fetchFinanceNotes();
  fetchFinanceApplication();
}

async function uploadDocument() {
  if (!selectedFile || !application) {
    alert("Please select a file.");
    return;
  }

  const fileExt = selectedFile.name.split(".").pop();

  const fileName = `${Date.now()}.${fileExt}`;

  const filePath = `finance/${application.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("finance-documents")
    .upload(filePath, selectedFile);

  if (uploadError) {
    alert("Upload failed: " + uploadError.message);
    return;
  }

  const { error: dbError } = await supabase
    .from("finance_documents")
    .insert({
      finance_application_id: application.id,
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      document_name: selectedFile.name,
      document_type: documentType,
      file_path: filePath,
      uploaded_by: "Finance User",
    });

  if (dbError) {
    alert("Database save failed: " + dbError.message);
    return;
  }

  if (application.lead_id) {
    await supabase.from("lead_activities").insert({
      lead_id: application.lead_id,
        company_id: profile?.company_id,
      title: "Finance Document Uploaded",
      description: `${documentType}: ${selectedFile.name}`,
      activity_type: "Document",
      color: "blue",
    });
  }

  alert("Document uploaded successfully.");

  setSelectedFile(null);

  fetchFinanceDocuments();
  fetchFinanceApplication();
}

  async function fetchFinanceApplication() {
    setLoading(true);

    const { data, error } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("id", financeId)
      .eq("company_id", profile?.company_id)
      .single();

    if (error) {
      console.error("Error loading finance application:", error.message);
      setLoading(false);
      return;
    }

    setApplication(data);
    setBank(data.bank || "");
    setFinanceNotes(data.finance_notes || "");

    if (data.lead_id) {
      const { data: activityData, error: activityError } = await supabase
  .from("lead_activities")
  .select("*")
  .eq("lead_id", data.lead_id)
  .eq("company_id", profile?.company_id)
  .order("created_at", { ascending: false });

await fetchFinanceNotes();
await fetchFinanceDocuments();

      if (activityError) {
        console.error("Error loading activities:", activityError.message);
      } else {
        setActivities(activityData || []);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
  if (!profile?.company_id) return;

  fetchFinanceApplication();
}, [profile?.company_id]);

  function statusClass(status: string | null) {
    if (status === "Approved") return "bg-green-100 text-green-700";
    if (status === "Declined") return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  }

  async function updateFinanceStatus(newStatus: string) {
    if (!application) return;

    const { error } = await supabase
      .from("finance_applications")
      .update({
        finance_status: newStatus,
        bank: bank,
        finance_notes: financeNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (error) {
      alert("Error updating finance application: " + error.message);
      return;
    }

    if (application.lead_id) {
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          finance: newStatus,
        })
        .eq("id", application.lead_id);

      if (leadUpdateError) {
        alert(
          "Finance updated, but lead finance status failed: " +
            leadUpdateError.message
        );
        return;
      }

      await supabase.from("lead_activities").insert({
        lead_id: application.lead_id,
          company_id: profile?.company_id,
        title: `Finance ${newStatus}`,
        description:
          financeNotes || `Finance application was updated to ${newStatus}.`,
        activity_type: "Finance",
        color:
          newStatus === "Approved"
            ? "green"
            : newStatus === "Declined"
            ? "red"
            : "orange",
      });

      await supabase.from("finance_notes").insert({
  finance_application_id: application.id,
  lead_id: application.lead_id,
    company_id: profile?.company_id,
  note:
    financeNotes ||
    `Finance application status updated to ${newStatus}.`,
  created_by: "Finance User",
});

    }

    fetchFinanceApplication();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-slate-500">
          Loading finance application...
        </div>
      </DashboardLayout>
    );
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-slate-600">Finance application not found.</p>
          <Link href="/finance" className="mt-4 inline-block text-blue-700">
            Back to Finance Queue
          </Link>
        </div>
      </DashboardLayout>
    );
  }

if (!canAccessRole(profile?.role, "finance")) {
  return (
    <DashboardLayout>
      <div className="rounded-xl bg-white p-10 shadow">
        <h1 className="text-2xl font-bold text-slate-800">
          Access Denied
        </h1>

        <p className="mt-3 text-slate-500">
          You do not have permission to access Finance.
        </p>
      </div>
    </DashboardLayout>
  );
}

return (
  <DashboardLayout>
    <PageAccessGuard module="finance">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/finance" className="text-sm text-slate-500">
            ← Back to Finance Queue
          </Link>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Finance Application
          </h1>

          <p className="text-slate-500">
            {application.customer} — {application.vehicle}
          </p>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-sm ${statusClass(
            application.finance_status
          )}`}
        >
          {application.finance_status || "Submitted"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">
              Deal Summary
            </h2>



            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium text-slate-800">
                  {application.customer}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Vehicle</p>
                <p className="font-medium text-slate-800">
                  {application.vehicle}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Requested Amount</p>
                <p className="font-medium text-slate-800">
                  R {Number(application.requested_amount || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Monthly Budget</p>
                <p className="font-medium text-slate-800">
                  R {Number(application.monthly_budget || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Deposit</p>
                <p className="font-medium text-slate-800">
                  R {Number(application.deposit || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Submitted</p>
                <p className="font-medium text-slate-800">
                  {application.submitted_at
                    ? new Date(application.submitted_at).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            </div>
          </div>

<div className="rounded-xl bg-white p-6 shadow">
  <h2 className="text-xl font-bold text-slate-800">
    Finance Notes History
  </h2>

  <div className="mt-5 space-y-3">
    <textarea
      placeholder="Add a new finance note..."
      value={newFinanceNote}
      onChange={(e) => setNewFinanceNote(e.target.value)}
      className="min-h-28 w-full rounded-lg border border-slate-300 p-3"
    />

    <button
      onClick={addFinanceNote}
      className="rounded-lg brand-primary-bg px-4 py-2 text-white"
    >
      Add Note
    </button>
  </div>

  <div className="mt-6 space-y-4">
    {financeNotesHistory.length === 0 ? (
      <p className="text-slate-500">No finance notes recorded yet.</p>
    ) : (
      financeNotesHistory.map((note) => (
        <div
          key={note.id}
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-slate-700">{note.note}</p>

          <p className="mt-2 text-xs text-slate-400">
            {note.created_by || "Finance User"} •{" "}
            {new Date(note.created_at).toLocaleString("en-ZA")}
          </p>
        </div>
      ))
    )}
  </div>
</div>

<div className="rounded-xl bg-white p-6 shadow">
  <h2 className="text-xl font-bold text-slate-800">
    Finance Documents
  </h2>

  <div className="mt-5 space-y-4">
    <select
      value={documentType}
      onChange={(e) => setDocumentType(e.target.value)}
      className="w-full rounded-lg border border-slate-300 p-3"
    >
      <option>ID Document</option>
      <option>Payslip</option>
      <option>Bank Statement</option>
      <option>Proof of Address</option>
      <option>Drivers License</option>
      <option>Other</option>
    </select>

    <input
      type="file"
      onChange={(e) => {
        if (e.target.files?.[0]) {
          setSelectedFile(e.target.files[0]);
        }
      }}
      className="w-full rounded-lg border border-slate-300 p-3"
    />

    <button
      onClick={uploadDocument}
      className="rounded-lg brand-primary-bg px-4 py-2 text-white"
    >
      Upload Document
    </button>
  </div>

  <div className="mt-6 space-y-4">
    {financeDocuments.length === 0 ? (
      <p className="text-slate-500">
        No documents uploaded yet.
      </p>
    ) : (
      financeDocuments.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div>
            <p className="font-medium text-slate-800">
              {doc.document_name}
            </p>

            <p className="text-sm text-slate-500">
              {doc.document_type}
            </p>
          </div>

          <div className="flex items-center gap-3">
  <span className="text-xs text-slate-400">
    {new Date(doc.created_at).toLocaleDateString("en-ZA")}
  </span>

  <button
    onClick={async () => {
      const { data, error } = await supabase.storage
        .from("finance-documents")
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        alert("Could not open document: " + error.message);
        return;
      }

      window.open(data.signedUrl, "_blank");
    }}
    className="rounded-lg brand-primary-bg px-3 py-2 text-xs text-white"
  >
    Preview
  </button>

  <button
    onClick={async () => {
      const { data, error } = await supabase.storage
        .from("finance-documents")
        .createSignedUrl(doc.file_path, 60, {
          download: doc.document_name,
        });

      if (error) {
        alert("Could not download document: " + error.message);
        return;
      }

      window.open(data.signedUrl, "_blank");
    }}
    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
  >
    Download
  </button>
</div>
        </div>
      ))
    )}
  </div>
</div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">
              Lead Timeline
            </h2>

            <div className="mt-5 space-y-4">
              {activities.length === 0 ? (
                <p className="text-slate-500">No timeline activity yet.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="border-l-4 border-slate-300 pl-4">
                    <p className="font-medium text-slate-800">
                      {activity.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {activity.created_at
                        ? new Date(activity.created_at).toLocaleString()
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-800">
            Finance Review
          </h2>

          <div className="mt-5 space-y-4">
            <input
              type="text"
              placeholder="Bank / Finance Provider"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3"
            />

            <textarea
              placeholder="Finance notes"
              value={financeNotes}
              onChange={(e) => setFinanceNotes(e.target.value)}
              className="min-h-32 w-full rounded-lg border border-slate-300 p-3"
            />

            <button
              onClick={() => updateFinanceStatus("Submitted")}
              className="w-full rounded-lg bg-orange-100 px-4 py-3 text-orange-700 hover:bg-orange-200"
            >
              Mark Pending
            </button>

            <button
              onClick={() => updateFinanceStatus("Approved")}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700"
            >
              Approve
            </button>

            <button
              onClick={() => updateFinanceStatus("Declined")}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700"
            >
              Decline
            </button>
          </div>

          {application.lead_id && (
            <Link
              href={`/leads/${application.lead_id}`}
              className="mt-5 block rounded-lg border border-slate-300 px-4 py-3 text-center text-slate-700 hover:bg-slate-50"
            >
              Open Linked Lead
            </Link>
          )}
        </div>
      </div>
          </PageAccessGuard>

    </DashboardLayout>
  );
}