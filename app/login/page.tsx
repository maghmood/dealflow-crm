"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginNotice = {
  tone: "warning" | "error" | "info";
  message: string;
};

function DealFlowMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg shadow-blue-900/20">
        <div className="absolute inset-0 rounded-2xl bg-white/10" />
        <div className="relative">
          <div className="mb-1 flex items-end gap-1">
            <span className="block h-2 w-2 rounded-sm bg-white/90" />
            <span className="block h-3 w-2 rounded-sm bg-white/90" />
            <span className="block h-4 w-2 rounded-sm bg-white/90" />
          </div>
          <div className="h-1.5 w-8 rounded-full bg-white/90" />
          <div className="mt-1 flex justify-between">
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          Deal<span className="text-blue-700">Flow</span>
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Drive your sales forward
        </p>
      </div>
    </div>
  );
}

function NoticeIcon({ tone }: { tone: LoginNotice["tone"] }) {
  if (tone === "error") return <span aria-hidden="true">⚠️</span>;
  if (tone === "warning") return <span aria-hidden="true">⏳</span>;
  return <span aria-hidden="true">ℹ️</span>;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("admin@planetauto.co.za");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (!email.trim() || !password.trim()) {
      setNotice({
        tone: "warning",
        message: "Please enter both your email address and password.",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
    <main className="min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.24),_transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.05)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.05)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-20" />

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <DealFlowMark />

              <div className="mt-14 max-w-lg">
                <p className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100">
                  Dealership CRM for leads, finance, tasks and delivery
                </p>

                <h2 className="mt-8 text-5xl font-black leading-tight tracking-tight">
                  Manage every deal from first contact to delivery.
                </h2>

                <p className="mt-6 text-lg leading-8 text-slate-300">
                  DealFlow helps your team track leads, customer communication,
                  finance applications, bank offers, vehicle preparation and
                  delivery in one clean workflow.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-bold text-white">
                  Communication Assist
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  WhatsApp Assist, Email Assist and Call outcomes are tracked without full WhatsApp API dependency.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">CRM</p>
                  <p className="mt-1 text-xs text-slate-300">Lead control</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">RLS</p>
                  <p className="mt-1 text-xs text-slate-300">Secure roles</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">MVP1</p>
                  <p className="mt-1 text-xs text-slate-300">Web based</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[680px] items-center justify-center bg-slate-50 p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-10 lg:hidden">
                <DealFlowMark />
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-700">
                  Secure sign in
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Welcome back
                </h2>

                <p className="mt-3 text-base leading-7 text-slate-500">
                  Sign in to continue managing dealership activity, customer
                  follow-ups and deal progress.
                </p>
              </div>

              {notice && (
                <div
                  role="alert"
                  className={`mt-6 rounded-2xl border p-4 shadow-sm ${noticeClasses}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-lg">
                      <NoticeIcon tone={notice.tone} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {notice.tone === "warning"
                          ? "Account attention needed"
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

              <div className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="dealflow-email"
                    className="text-sm font-bold text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="dealflow-email"
                    type="email"
                    placeholder="you@dealership.co.za"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="dealflow-password"
                      className="text-sm font-bold text-slate-700"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <input
                    id="dealflow-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) {
                        void login();
                      }
                    }}
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void login()}
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in to DealFlow"}
                </button>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
                <p className="font-bold text-slate-700">
                  First-time tester note
                </p>
                <p className="mt-1">
                  Use the test credentials supplied in the testing guide. If access
                  fails, confirm the user is active in User Management.
                </p>
              </div>

              <p className="mt-8 text-center text-xs text-slate-400">
                DealFlow CRM • Secure dealership workflow platform
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
