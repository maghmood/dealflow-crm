"use client";

import { useAuth } from "@/components/AuthProvider";
import { canWriteRole } from "@/lib/auth";

export default function WriteAccessGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (!canWriteRole(profile?.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}