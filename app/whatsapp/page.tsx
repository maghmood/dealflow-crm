"use client";

import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function WhatsAppInboxPage() {
  return (
    <DashboardLayout>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
          💬
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          WhatsApp Integration Disabled
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Full WhatsApp API inbox, inbound sync and direct Meta messaging are disabled for MVP1.
          Use Communication Assist on the Lead, Customer or Deal pages to prepare messages,
          track outcomes and create follow-up tasks without paid WhatsApp integration.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/leads"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Go to Leads
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
