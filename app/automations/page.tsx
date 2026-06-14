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
  stale_candidates?: number;
  stale_processed?: number;
  whatsapp_candidates?: number;
  whatsapp_processed?: number;
  error_message?: string | null;
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

  const [staleDays, setStaleDays] = useState("7");
  const [whatsappSlaMinutes, setWhatsappSlaMinutes] =
    useState("30");

  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  const [lastManualResult, setLastManualResult] =
    useState<ManualRunResult | null>(null);

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

  async function runAutomationsNow() {
    if (!profile?.company_id) return;

    const staleDaysNumber = Number(staleDays);
    const whatsappSlaNumber = Number(
      whatsappSlaMinutes
    );

    if (
      !Number.isInteger(staleDaysNumber) ||
      staleDaysNumber < 1
    ) {
      alert(
        "Stale lead threshold must be at least 1 day."
      );
      return;
    }

    if (
      !Number.isInteger(whatsappSlaNumber) ||
      whatsappSlaNumber < 1
    ) {
      alert(
        "WhatsApp SLA must be at least 1 minute."
      );
      return;
    }

    const confirmed = window.confirm(
      `Run automations now?\n\n` +
        `Stale lead threshold: ${staleDaysNumber} days\n` +
        `WhatsApp SLA: ${whatsappSlaNumber} minutes`
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

      if (sessionError || !accessToken) {
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            companyId: profile.company_id,
            staleDays: staleDaysNumber,
            whatsappSlaMinutes:
              whatsappSlaNumber,
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

      if (!response.ok || !result.success) {
        alert(
          "Automation run failed: " +
            (result.error || "Unknown error")
        );
        return;
      }

      setLastManualResult(result.result || null);

      await fetchAutomationRuns();

      alert("Automations completed successfully.");
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
                      min="1"
                      step="1"
                      value={staleDays}
                      onChange={(event) =>
                        setStaleDays(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 p-3"
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
                      min="1"
                      step="1"
                      value={whatsappSlaMinutes}
                      onChange={(event) =>
                        setWhatsappSlaMinutes(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 p-3"
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