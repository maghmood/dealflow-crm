"use client";

import DashboardLayout from "@/components/DashboardLayout";
import PageAccessGuard from "@/components/PageAccessGuard";

export default function WhatsAppInboxPage() {
  return (
    <DashboardLayout>
      <PageAccessGuard module="whatsapp">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              WhatsApp Inbox
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage customer WhatsApp conversations and responses.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="text-4xl">💬</div>

            <h2 className="mt-4 text-xl font-bold text-slate-800">
              WhatsApp Inbox foundation ready
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Conversation list and messaging panel will be added in the next
              batch.
            </p>
          </div>
        </div>
      </PageAccessGuard>
    </DashboardLayout>
  );
}