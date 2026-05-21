"use client";

import { useAuth } from "@/components/AuthProvider";
import { AppModule, canAccessRole } from "@/lib/auth";

export default function PageAccessGuard({
  module,
  children,
}: {
  module: AppModule;
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 shadow">
        <h1 className="text-2xl font-bold text-slate-800">
          Checking permissions...
        </h1>
        <p className="mt-3 text-slate-500">
          Please wait while we confirm your access.
        </p>
      </div>
    );
  }

  if (!canAccessRole(profile?.role, module)) {
    return (
      <div className="rounded-xl bg-white p-10 shadow">
        <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="mt-3 text-slate-500">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}