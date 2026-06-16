"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export type UserRole =
  | "Admin"
  | "Manager"
  | "Sales"
  | "Finance"
  | "Stock"
  | "ReadOnly";

export type UserStatus = "Active" | "Inactive";

type UserProfile = {
  id: number;
  auth_user_id: string;
  company_id: number;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
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

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
const profileRef = useRef<UserProfile | null>(
  null
);
  const blockingInactiveUser = useRef(false);

  const blockInactiveUser = useCallback(async () => {
    if (blockingInactiveUser.current) return;

    blockingInactiveUser.current = true;

    setProfile(null);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "Error signing out inactive user:",
        error
      );
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "dealflow_auth_message",
        "Your account is inactive. Please contact your administrator."
      );

      window.location.replace(
        "/login?reason=inactive"
      );
    }
  }, []);

  const refreshProfile = useCallback(async () => {
  const isInitialLoad =
    profileRef.current === null;

  if (isInitialLoad) {
    setLoading(true);
  }

  try {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session?.user
    ) {
      /*
       * Only clear the page when there truly is no
       * authenticated session.
       */
      setProfile(null);
      profileRef.current = null;
      return;
    }

    const authenticatedUser =
      sessionData.session.user;

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "id, auth_user_id, company_id, full_name, email, role, status"
      )
      .eq(
        "auth_user_id",
        authenticatedUser.id
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Error loading user profile:",
        error.message
      );

      /*
       * A temporary network or focus-refresh error
       * must not remove an already loaded profile.
       */
      if (!profileRef.current) {
        setProfile(null);
      }

      return;
    }

    if (!data) {
      setProfile(null);
      profileRef.current = null;

      await supabase.auth.signOut();

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "dealflow_auth_message",
          "Your user profile could not be found. Please contact your administrator."
        );

        window.location.replace(
          "/login?reason=profile-missing"
        );
      }

      return;
    }

    const loadedProfile =
      data as UserProfile;

    if (loadedProfile.status !== "Active") {
      await blockInactiveUser();
      return;
    }

    blockingInactiveUser.current = false;

    profileRef.current =
      loadedProfile;

    setProfile(
      loadedProfile
    );
  } catch (error) {
    console.error(
      "Unexpected profile refresh error:",
      error
    );

    /*
     * Keep the existing authenticated page mounted
     * during temporary browser focus or network errors.
     */
    if (!profileRef.current) {
      setProfile(null);
    }
  } finally {
    setLoading(false);
  }
}, [blockInactiveUser]);

  useEffect(() => {
  void refreshProfile();

  const { data: listener } =
    supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setLoading(false);
          return;
        }

        /*
         * Do not call and await another Supabase Auth method
         * directly inside onAuthStateChange. Schedule the
         * profile refresh after the callback has completed.
         */
        window.setTimeout(() => {
          void refreshProfile();
        }, 0);
      }
    );

  return () => {
    listener.subscription.unsubscribe();
  };
}, [refreshProfile]);

  /*
   * Recheck the profile whenever the user navigates.
   * This catches accounts made inactive while an old
   * session is still open.
   */
  useEffect(() => {
  if (pathname.startsWith("/login")) return;

  const timeoutId = window.setTimeout(() => {
    void refreshProfile();
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, [pathname, refreshProfile]);

useEffect(() => {
  profileRef.current = profile;
}, [profile]);

  /*
   * Recheck when the browser tab becomes active again.
   */
  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        !pathname.startsWith("/login")
      ) {
        refreshProfile();
      }
    }

    function handleWindowFocus() {
  void refreshProfile();
}

window.addEventListener(
  "focus",
  handleWindowFocus
);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener(
  "focus",
  handleWindowFocus
);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [pathname, refreshProfile]);

  /*
   * Periodic status check for long-running sessions.
   */
  useEffect(() => {
    if (pathname.startsWith("/login")) return;

    const intervalId = window.setInterval(
      () => {
        refreshProfile();
      },
      60_000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pathname, refreshProfile]);

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