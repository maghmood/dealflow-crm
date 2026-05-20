"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserRole =
  | "Admin"
  | "Manager"
  | "Sales"
  | "Finance"
  | "Stock"
  | "ReadOnly";

type UserProfile = {
  id: number;
  auth_user_id: string;
  company_id: number;
  full_name: string | null;
  email: string | null;
  role: UserRole;
};

type AuthContextType = {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading user profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    refreshProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}