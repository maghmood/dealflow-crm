"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

type AutomationRun = {
  id: number;
  company_id: number;
  run_source: string;
  status:
    | "Running"
    | "Completed"
    | "Partially Completed"
    | "Failed";
  stale_threshold_days: number | null;
  whatsapp_sla_minutes: number | null;
  stale_candidate_count: number;
  stale_processed_count: number;
  whatsapp_candidate_count: number;
  whatsapp_processed_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

type ManualRunResult = {
  run_id?: number;
  final_status?: string;

  stale_enabled?: boolean;
  stale_candidates?: number;
  stale_processed?: number;

  whatsapp_enabled?: boolean;
  whatsapp_candidates?: number;
  whatsapp_processed?: number;

  error_message?: string | null;
};

type AutomationSettings = {
  id: number;
  company_id: number;

  stale_lead_enabled: boolean;
  stale_lead_days: number;

  whatsapp_sla_enabled: boolean;
  whatsapp_sla_minutes: number;

  business_hours_enabled: boolean;
  business_day_start: string;
  business_day_end: string;

  include_saturday: boolean;
  include_sunday: boolean;

  timezone_name: string;

  updated_by_id: number | null;
  updated_by_name: string | null;

  created_at: string;
  updated_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(
  startedAt: string,
  completedAt: string | null
) {
  if (!completedAt) return "Running";

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end < start
  ) {
    return "-";
  }

  const milliseconds = end - start;

  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }

  const seconds = milliseconds / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes} min ${remainingSeconds} sec`;
}

function statusStyle(status: AutomationRun["status"]) {
  if (status === "Completed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Partially Completed") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "Failed") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

export default function AutomationsPage() {
  const { profile } = useAuth();

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningNow, setRunningNow] = useState(false);
const [automationSettings, setAutomationSettings] =
  useState<AutomationSettings | null>(null);

const [loadingSettings, setLoadingSettings] =
  useState(true);

const [savingSettings, setSavingSettings] =
  useState(false);

const [staleLeadEnabled, setStaleLeadEnabled] =
  useState(true);

const [whatsappSlaEnabled, setWhatsappSlaEnabled] =
  useState(true);

const [businessHoursEnabled, setBusinessHoursEnabled] =
  useState(false);

const [businessDayStart, setBusinessDayStart] =
  useState("08:00");

const [businessDayEnd, setBusinessDayEnd] =
  useState("17:00");

const [includeSaturday, setIncludeSaturday] =
  useState(false);

const [includeSunday, setIncludeSunday] =
  useState(false);

const [timezoneName, setTimezoneName] =
  useState("Africa/Johannesburg");
  const [staleDays, setStaleDays] = useState("7");
  const [whatsappSlaMinutes, setWhatsappSlaMinutes] =
    useState("30");

  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  const [lastManualResult, setLastManualResult] =
    useState<ManualRunResult | null>(null);

  async function fetchAutomationSettings() {
  if (!profile?.company_id) return;

  setLoadingSettings(true);

  const { data, error } = await supabase
    .from("automation_settings")
    .select(
      "id, company_id, stale_lead_enabled, stale_lead_days, whatsapp_sla_enabled, whatsapp_sla_minutes, business_hours_enabled, business_day_start, business_day_end, include_saturday, include_sunday, timezone_name, updated_by_id, updated_by_name, created_at, updated_at"
    )
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (error) {
    console.error(
      "Error loading automation settings:",
      error.message
    );

    setAutomationSettings(null);
    setLoadingSettings(false);
    return;
  }

  if (!data) {
    setAutomationSettings(null);
    setLoadingSettings(false);
    return;
  }

  const settings = data as AutomationSettings;

  setAutomationSettings(settings);

  setStaleLeadEnabled(settings.stale_lead_enabled);
  setStaleDays(String(settings.stale_lead_days));

  setWhatsappSlaEnabled(
    settings.whatsapp_sla_enabled
  );

  setWhatsappSlaMinutes(
    String(settings.whatsapp_sla_minutes)
  );

  setBusinessHoursEnabled(
    settings.business_hours_enabled
  );

  setBusinessDayStart(
    settings.business_day_start.slice(0, 5)
  );

  setBusinessDayEnd(
    settings.business_day_end.slice(0, 5)
  );

  setIncludeSaturday(settings.include_saturday);
  setIncludeSunday(settings.include_sunday);

  setTimezoneName(
    settings.timezone_name ||
      "Africa/Johannesburg"
  );

  setLoadingSettings(false);
}

  async function fetchAutomationRuns() {
    if (!profile?.company_id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("automation_runs")
      .select(
        "id, company_id, run_source, status, stale_threshold_days, whatsapp_sla_minutes, stale_candidate_count, stale_processed_count, whatsapp_candidate_count, whatsapp_processed_count, error_message, started_at, completed_at"
      )
      .eq("company_id", profile.company_id)
      .order("started_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(
        "Error loading automation runs:",
        error.message
      );
      setRuns([]);
    } else {
      setRuns(
        Array.isArray(data)
          ? (data as AutomationRun[])
          : []
      );
    }

    setLoading(false);
  }

  useEffect(() => {
  if (!profile?.company_id) return;

  fetchAutomationRuns();
  fetchAutomationSettings();
}, [profile?.company_id]);

  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel(
        `automation-runs-company-${profile.company_id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_runs",
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          fetchAutomationRuns();
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            "Automation monitoring Realtime error:",
            error
          );
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Automation monitoring channel status:",
            status
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id]);

  async function saveAutomationSettings() {
  if (!profile?.company_id || !profile?.id) return;

  const staleDaysNumber = Number(staleDays);
  const whatsappSlaNumber = Number(
    whatsappSlaMinutes
  );

  if (
    !Number.isInteger(staleDaysNumber) ||
    staleDaysNumber < 1 ||
    staleDaysNumber > 365
  ) {
    alert(
      "Stale lead threshold must be between 1 and 365 days."
    );
    return;
  }

  if (
    !Number.isInteger(whatsappSlaNumber) ||
    whatsappSlaNumber < 1 ||
    whatsappSlaNumber > 10080
  ) {
    alert(
      "WhatsApp SLA must be between 1 and 10,080 minutes."
    );
    return;
  }

  if (
    businessHoursEnabled &&
    businessDayEnd <= businessDayStart
  ) {
    alert(
      "Business closing time must be later than the opening time."
    );
    return;
  }

  setSavingSettings(true);

  const payload = {
    company_id: profile.company_id,

    stale_lead_enabled: staleLeadEnabled,
    stale_lead_days: staleDaysNumber,

    whatsapp_sla_enabled: whatsappSlaEnabled,
    whatsapp_sla_minutes: whatsappSlaNumber,

    business_hours_enabled: businessHoursEnabled,
    business_day_start: businessDayStart,
    business_day_end: businessDayEnd,

    include_saturday: includeSaturday,
    include_sunday: includeSunday,

    timezone_name: timezoneName,

    updated_by_id: profile.id,
    updated_by_name:
      profile.full_name ||
      profile.email ||
      "Unknown User",
  };

  const { data, error } = await supabase
    .from("automation_settings")
    .upsert(payload, {
      onConflict: "company_id",
    })
    .select(
      "id, company_id, stale_lead_enabled, stale_lead_days, whatsapp_sla_enabled, whatsapp_sla_minutes, business_hours_enabled, business_day_start, business_day_end, include_saturday, include_sunday, timezone_name, updated_by_id, updated_by_name, created_at, updated_at"
    )
    .single();

  if (error) {
    alert(
      "Error saving automation settings: " +
        error.message
    );

    setSavingSettings(false);
    return;
  }

  setAutomationSettings(
    data as AutomationSettings
  );

  setSavingSettings(false);

  alert("Automation settings saved successfully.");
}

  async function runAutomationsNow() {
  if (
    !profile?.company_id ||
    !automationSettings
  ) {
    alert(
      "Automation settings have not loaded yet."
    );
    return;
  }

  if (
    !automationSettings.stale_lead_enabled &&
    !automationSettings.whatsapp_sla_enabled
  ) {
    alert(
      "At least one automation rule must be enabled."
    );
    return;
  }

  const enabledRules = [
    automationSettings.stale_lead_enabled
      ? `Stale leads after ${automationSettings.stale_lead_days} days`
      : null,

    automationSettings.whatsapp_sla_enabled
      ? `WhatsApp SLA after ${automationSettings.whatsapp_sla_minutes} minutes`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const confirmed = window.confirm(
    `Run the saved automation settings now?\n\n${enabledRules}`
  );

  if (!confirmed) return;

  setRunningNow(true);
  setLastManualResult(null);

  try {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    const accessToken =
      sessionData.session?.access_token;

    if (
      sessionError ||
      !accessToken
    ) {
      alert(
        "Your login session has expired. Please sign in again."
      );
      return;
    }

    const response = await fetch(
      "/api/automations/run",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId:
            profile.company_id,
        }),
      }
    );

    let result: {
      success?: boolean;
      error?: string | null;
      result?: ManualRunResult | null;
    };

    try {
      result = await response.json();
    } catch {
      alert(
        "Automation route returned an invalid response."
      );
      return;
    }

    if (
      !response.ok ||
      !result.success
    ) {
      alert(
        "Automation run failed: " +
          (result.error || "Unknown error")
      );
      return;
    }

    setLastManualResult(
      result.result || null
    );

    await Promise.all([
      fetchAutomationRuns(),
      fetchAutomationSettings(),
    ]);

    alert(
      "Automations completed successfully using the saved settings."
    );
  } catch (error) {
    console.error(
      "Unexpected automation run error:",
      error
    );

    alert(
      "Unexpected error while running automations."
    );
  } finally {
    setRunningNow(false);
  }
}

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesStatus =
        statusFilter === "All" ||
        run.status === statusFilter;

      const matchesSource =
        sourceFilter === "All" ||
        run.run_source === sourceFilter;

      return matchesStatus && matchesSource;
    });
  }, [runs, statusFilter, sourceFilter]);

  const totalRuns = runs.length;

  const successfulRuns = runs.filter(
    (run) => run.status === "Completed"
  ).length;

  const failedRuns = runs.filter(
    (run) =>
      run.status === "Failed" ||
      run.status === "Partially Completed"
  ).length;

  const runningRuns = runs.filter(
    (run) => run.status === "Running"
  ).length;

  const latestRun = runs[0] || null;

  const last24Hours = Date.now() - 24 * 60 * 60 * 1000;

  const runsLast24Hours = runs.filter(
    (run) =>
      new Date(run.started_at).getTime() >=
      last24Hours
  ).length;

  const totalStaleProcessed = runs.reduce(
    (sum, run) =>
      sum + Number(run.stale_processed_count || 0),
    0
  );

  const totalWhatsappProcessed = runs.reduce(
    (sum, run) =>
      sum +
      Number(run.whatsapp_processed_count || 0),
    0
  );

  return (
    <DashboardLayout>
      <PageAccessGuard module="automations">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Automation Monitoring
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Monitor scheduled workflow runs, thresholds,
                failures and automated task processing.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchAutomationRuns}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <MetricCard
              label="Total Runs"
              value={totalRuns}
            />

            <MetricCard
              label="Successful"
              value={successfulRuns}
              color="green"
            />

            <MetricCard
              label="Failed / Partial"
              value={failedRuns}
              color={failedRuns > 0 ? "red" : "green"}
            />

            <MetricCard
              label="Currently Running"
              value={runningRuns}
              color="blue"
            />

            <MetricCard
              label="Runs in Last 24 Hours"
              value={runsLast24Hours}
              color="purple"
            />

            <MetricCard
              label="Stale Checks Processed"
              value={totalStaleProcessed}
              color="orange"
            />

            <MetricCard
              label="WhatsApp Checks Processed"
              value={totalWhatsappProcessed}
              color="green"
            />
          </div>

         <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-900">
        Automation Settings
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Configure workflow rules for this company.
      </p>
    </div>

    {automationSettings && (
      <div className="text-sm text-slate-500">
        <p>
          Last updated by{" "}
          <span className="font-semibold text-slate-700">
            {automationSettings.updated_by_name ||
              "System"}
          </span>
        </p>

        <p className="mt-1">
          {formatDateTime(
            automationSettings.updated_at
          )}
        </p>
      </div>
    )}
  </div>

  {loadingSettings ? (
    <div className="mt-6 rounded-xl bg-slate-50 p-5 text-slate-500">
      Loading automation settings...
    </div>
  ) : (
    <div className="mt-6 space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">
                Stale Lead Automation
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create follow-up tasks when leads have no
                recorded CRM activity.
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={staleLeadEnabled}
                onChange={(event) =>
                  setStaleLeadEnabled(
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <span className="text-sm font-semibold text-slate-700">
                Enabled
              </span>
            </label>
          </div>

          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700">
              Inactivity Threshold
            </label>

            <div className="mt-1 flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                value={staleDays}
                onChange={(event) =>
                  setStaleDays(event.target.value)
                }
                disabled={!staleLeadEnabled}
                className="w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100 disabled:text-slate-400"
              />
<p
  className={`mt-2 text-xs font-semibold ${
    automationSettings?.stale_lead_enabled
      ? "text-green-600"
      : "text-slate-400"
  }`}
>
  {automationSettings?.stale_lead_enabled
    ? "Rule enabled"
    : "Rule disabled"}
</p>
              <span className="text-sm text-slate-500">
                days
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">
                WhatsApp SLA Automation
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create urgent tasks when customers wait too
                long for a WhatsApp response.
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappSlaEnabled}
                onChange={(event) =>
                  setWhatsappSlaEnabled(
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />
<p
  className={`mt-2 text-xs font-semibold ${
    automationSettings?.whatsapp_sla_enabled
      ? "text-green-600"
      : "text-slate-400"
  }`}
>
  {automationSettings?.whatsapp_sla_enabled
    ? "Rule enabled"
    : "Rule disabled"}
</p>
              <span className="text-sm font-semibold text-slate-700">
                Enabled
              </span>
            </label>
          </div>

          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700">
              Response SLA
            </label>

            <div className="mt-1 flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10080"
                step="1"
                value={whatsappSlaMinutes}
                onChange={(event) =>
                  setWhatsappSlaMinutes(
                    event.target.value
                  )
                }
                disabled={!whatsappSlaEnabled}
                className="w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100 disabled:text-slate-400"
              />

              <span className="text-sm text-slate-500">
                minutes
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900">
              Business Hours
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Store the company operating schedule for
              business-hour-aware SLA calculations.
            </p>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={businessHoursEnabled}
              onChange={(event) =>
                setBusinessHoursEnabled(
                  event.target.checked
                )
              }
              className="h-5 w-5"
            />

            <span className="text-sm font-semibold text-slate-700">
              Enabled
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Opening Time
            </label>

            <input
              type="time"
              value={businessDayStart}
              onChange={(event) =>
                setBusinessDayStart(
                  event.target.value
                )
              }
              disabled={!businessHoursEnabled}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Closing Time
            </label>

            <input
              type="time"
              value={businessDayEnd}
              onChange={(event) =>
                setBusinessDayEnd(
                  event.target.value
                )
              }
              disabled={!businessHoursEnabled}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Timezone
            </label>

            <select
              value={timezoneName}
              onChange={(event) =>
                setTimezoneName(event.target.value)
              }
              disabled={!businessHoursEnabled}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
            >
              <option value="Africa/Johannesburg">
                South Africa
              </option>
            </select>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeSaturday}
                onChange={(event) =>
                  setIncludeSaturday(
                    event.target.checked
                  )
                }
                disabled={!businessHoursEnabled}
                className="h-5 w-5"
              />

              <span className="text-sm font-semibold text-slate-700">
                Include Saturday
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeSunday}
                onChange={(event) =>
                  setIncludeSunday(
                    event.target.checked
                  )
                }
                disabled={!businessHoursEnabled}
                className="h-5 w-5"
              />

              <span className="text-sm font-semibold text-slate-700">
                Include Sunday
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={saveAutomationSettings}
          disabled={savingSettings}
          className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {savingSettings
            ? "Saving Settings..."
            : "Save Automation Settings"}
        </button>
      </div>
    </div>
  )}
</div> 

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Run Automations Now
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Execute both workflow rules immediately using
                the thresholds below.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Stale Lead Threshold
                  </label>

                  <div className="mt-1 flex items-center gap-3">
                    <input
  type="number"
  value={
    automationSettings?.stale_lead_days ??
    staleDays
  }
  readOnly
  className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600"
/>

                    <span className="text-sm text-slate-500">
                      days
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    WhatsApp Response SLA
                  </label>

                  <div className="mt-1 flex items-center gap-3">
                    <input
  type="number"
  value={
    automationSettings?.whatsapp_sla_minutes ??
    whatsappSlaMinutes
  }
  readOnly
  className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600"
/>

                    <span className="text-sm text-slate-500">
                      minutes
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runAutomationsNow}
                  disabled={runningNow}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runningNow
                    ? "Running Automations..."
                    : "Run Automations Now"}
                </button>
              </div>

              {lastManualResult && (
                <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="font-semibold text-green-800">
                    Last manual run completed
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <ResultItem
                      label="Status"
                      value={
                        lastManualResult.final_status ||
                        "Completed"
                      }
                    />

                    <ResultItem
                      label="Run ID"
                      value={
                        lastManualResult.run_id || "-"
                      }
                    />
<ResultItem
  label="Stale Rule"
  value={
    lastManualResult.stale_enabled
      ? "Enabled"
      : "Disabled"
  }
/>

                    <ResultItem
                      label="Stale Candidates"
                      value={
                        lastManualResult.stale_candidates ||
                        0
                      }
                    />

                    <ResultItem
                      label="Stale Processed"
                      value={
                        lastManualResult.stale_processed ||
                        0
                      }
                    />
<ResultItem
  label="WhatsApp Rule"
  value={
    lastManualResult.whatsapp_enabled
      ? "Enabled"
      : "Disabled"
  }
/>
                    <ResultItem
                      label="WhatsApp Candidates"
                      value={
                        lastManualResult.whatsapp_candidates ||
                        0
                      }
                    />

                    <ResultItem
                      label="WhatsApp Processed"
                      value={
                        lastManualResult.whatsapp_processed ||
                        0
                      }
                    />

                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Current Status
              </h2>

              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Latest Run"
                  value={
                    latestRun
                      ? formatDateTime(
                          latestRun.started_at
                        )
                      : "No runs yet"
                  }
                />

                <StatusRow
                  label="Latest Status"
                  value={
                    latestRun?.status || "Not available"
                  }
                />

                <StatusRow
                  label="Latest Source"
                  value={
                    latestRun?.run_source ||
                    "Not available"
                  }
                />

                <StatusRow
                  label="Stale Threshold"
                  value={
                    latestRun?.stale_threshold_days
                      ? `${latestRun.stale_threshold_days} days`
                      : "Not available"
                  }
                />

                <StatusRow
                  label="WhatsApp SLA"
                  value={
                    latestRun?.whatsapp_sla_minutes
                      ? `${latestRun.whatsapp_sla_minutes} minutes`
                      : "Not available"
                  }
                />

                <StatusRow
                  label="Latest Duration"
                  value={
                    latestRun
                      ? formatDuration(
                          latestRun.started_at,
                          latestRun.completed_at
                        )
                      : "-"
                  }
                />
              </div>

              {latestRun?.error_message && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-700">
                    Latest Error
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-red-600">
                    {latestRun.error_message}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Automation Run History
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Latest 100 workflow automation executions.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="All">
                      All Statuses
                    </option>
                    <option value="Completed">
                      Completed
                    </option>
                    <option value="Partially Completed">
                      Partially Completed
                    </option>
                    <option value="Failed">
                      Failed
                    </option>
                    <option value="Running">
                      Running
                    </option>
                  </select>

                  <select
                    value={sourceFilter}
                    onChange={(event) =>
                      setSourceFilter(event.target.value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="All">
                      All Sources
                    </option>
                    <option value="Manual">
                      Manual
                    </option>
                    <option value="Supabase Cron">
                      Supabase Cron
                    </option>
                    <option value="Vercel Cron">
                      Vercel Cron
                    </option>
                    <option value="API">
                      API
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-slate-500">
                  Loading automation runs...
                </div>
              ) : (
                <table className="min-w-[1350px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>Run</TableHeading>
                      <TableHeading>Source</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>
                        Started
                      </TableHeading>
                      <TableHeading>
                        Duration
                      </TableHeading>
                      <TableHeading>
                        Stale Threshold
                      </TableHeading>
                      <TableHeading>
                        Stale Candidates
                      </TableHeading>
                      <TableHeading>
                        Stale Processed
                      </TableHeading>
                      <TableHeading>
                        WA SLA
                      </TableHeading>
                      <TableHeading>
                        WA Candidates
                      </TableHeading>
                      <TableHeading>
                        WA Processed
                      </TableHeading>
                      <TableHeading>Error</TableHeading>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="border-t border-slate-100"
                      >
                        <TableCell>
                          #{run.id}
                        </TableCell>

                        <TableCell>
                          {run.run_source}
                        </TableCell>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                              run.status
                            )}`}
                          >
                            {run.status}
                          </span>
                        </td>

                        <TableCell>
                          {formatDateTime(run.started_at)}
                        </TableCell>

                        <TableCell>
                          {formatDuration(
                            run.started_at,
                            run.completed_at
                          )}
                        </TableCell>

                        <TableCell>
                          {run.stale_threshold_days
                            ? `${run.stale_threshold_days} days`
                            : "-"}
                        </TableCell>

                        <TableCell>
                          {run.stale_candidate_count}
                        </TableCell>

                        <TableCell>
                          {run.stale_processed_count}
                        </TableCell>

                        <TableCell>
                          {run.whatsapp_sla_minutes
                            ? `${run.whatsapp_sla_minutes} min`
                            : "-"}
                        </TableCell>

                        <TableCell>
                          {run.whatsapp_candidate_count}
                        </TableCell>

                        <TableCell>
                          {run.whatsapp_processed_count}
                        </TableCell>

                        <TableCell>
                          {run.error_message || "-"}
                        </TableCell>
                      </tr>
                    ))}

                    {filteredRuns.length === 0 && (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-4 py-10 text-center text-slate-500"
                        >
                          No automation runs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </PageAccessGuard>
    </DashboardLayout>
  );
}

function MetricCard({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: string | number;
  color?: "slate" | "blue" | "green" | "red" | "orange" | "purple";
}) {
  const styles = {
    slate: "bg-slate-100 text-slate-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    orange: "bg-orange-100 text-orange-800",
    purple: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <div
        className={`mt-3 inline-flex rounded-xl px-4 py-2 text-2xl font-bold ${styles[color]}`}
      >
        {value}
      </div>
    </div>
  );
}

function ResultItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg bg-white/80 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="max-w-xs px-4 py-4 text-sm text-slate-700">
      <div className="truncate">{children}</div>
    </td>
  );
}