"use client";

import { useAuth } from "@/components/AuthProvider";
import { isReadOnlyRole } from "@/lib/auth";

export default function ReadOnlyNotice() {
  const { profile, loading } = useAuth();

  if (loading || !isReadOnlyRole(profile?.role)) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      You are viewing this page in read-only mode. Create, edit, upload and delete
      actions are disabled for your role.
    </div>
  );
}