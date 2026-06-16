"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginNotice = {
  tone: "warning" | "error" | "info";
  message: string;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("admin@planetauto.co.za");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<LoginNotice | null>(null);

  useEffect(() => {
    const reason = searchParams.get("reason");
    const storedMessage =
      window.sessionStorage.getItem("dealflow_auth_message");

    if (reason === "inactive") {
      setNotice({
        tone: "warning",
        message:
          storedMessage ||
          "Your DealFlow account is inactive. Please contact your administrator to restore access.",
      });
      return;
    }

    if (reason === "profile-missing") {
      setNotice({
        tone: "error",
        message:
          storedMessage ||
          "Your DealFlow user profile could not be found. Please contact your administrator.",
      });
      return;
    }

    if (storedMessage) {
      setNotice({
        tone: "info",
        message: storedMessage,
      });
    }
  }, [searchParams]);

  async function login() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setNotice({
        tone: "error",
        message: `Login failed: ${error.message}`,
      });
      return;
    }

    window.sessionStorage.removeItem("dealflow_auth_message");
    setNotice(null);
    router.push("/");
  }

  function dismissNotice() {
    window.sessionStorage.removeItem("dealflow_auth_message");
    setNotice(null);
  }

  const noticeClasses =
    notice?.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : notice?.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-slate-800">
          DealFlow Login
        </h1>

        <p className="mt-2 text-slate-500">
          Sign in to your dealership CRM
        </p>

        {notice && (
          <div
            role="alert"
            className={`mt-5 rounded-xl border p-4 ${noticeClasses}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">
                  {notice.tone === "warning"
                    ? "Account unavailable"
                    : notice.tone === "error"
                    ? "Unable to sign in"
                    : "Notice"}
                </p>

                <p className="mt-1 text-sm leading-6">
                  {notice.message}
                </p>
              </div>

              <button
                type="button"
                onClick={dismissNotice}
                className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-black/5"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                void login();
              }
            }}
            className="w-full rounded-lg border border-slate-300 p-3"
          />

          <button
            type="button"
            onClick={() => void login()}
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
