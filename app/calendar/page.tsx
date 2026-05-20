"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type CalendarTask = {
  id: number;
  title: string | null;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  task_type: string | null;
  assigned_user_name: string | null;
  lead_id: number | null;
};

function priorityBadge(priority: string | null) {
  const value = priority || "Medium";

  const styles: Record<string, string> = {
    Low: "bg-slate-100 text-slate-700",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-orange-100 text-orange-700",
    Urgent: "bg-red-100 text-red-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

function typeBadge(type: string | null) {
  const value = type || "Task";

  const styles: Record<string, string> = {
    Followup: "bg-purple-100 text-purple-700",
    "Follow-up": "bg-purple-100 text-purple-700",
    Call: "bg-green-100 text-green-700",
    Finance: "bg-indigo-100 text-indigo-700",
    Delivery: "bg-teal-100 text-teal-700",
    Meeting: "bg-yellow-100 text-yellow-700",
    "Test Drive": "bg-orange-100 text-orange-700",
  };

  return styles[value] || "bg-slate-100 text-slate-700";
}

export default function CalendarPage() {
  const { profile } = useAuth();

  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  async function fetchTasks() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("due_date", { ascending: true });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading calendar:", error.message);
      setTasks([]);
    } else {
      setTasks(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, [profile?.company_id, profile?.role, profile?.id]);

  const today = new Date();

  const todayTasks = tasks.filter((task) => {
    if (!task.due_date) return false;

    return (
      new Date(task.due_date).toDateString() ===
      today.toDateString()
    );
  });

  const overdueTasks = tasks.filter((task) => {
    if (!task.due_date) return false;

    return (
      new Date(task.due_date) < today &&
      task.status !== "Completed"
    );
  });

  const upcomingTasks = tasks.filter((task) => {
    if (!task.due_date) return false;

    return new Date(task.due_date) > today;
  });

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed"
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;

      return (
        new Date(task.due_date)
          .toISOString()
          .split("T")[0] === selectedDate
      );
    });
  }, [tasks, selectedDate]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Calendar
            </h1>

            <p className="text-slate-500">
              Dealership appointments, follow-ups and scheduling
            </p>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Tasks Today
            </p>

            <h2 className="mt-2 text-3xl font-bold text-blue-700">
              {todayTasks.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Overdue
            </p>

            <h2 className="mt-2 text-3xl font-bold text-red-700">
              {overdueTasks.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Upcoming
            </p>

            <h2 className="mt-2 text-3xl font-bold text-orange-700">
              {upcomingTasks.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Completed
            </p>

            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {completedTasks.length}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {[
              ["📞", "Calls"],
              ["🚗", "Test Drives"],
              ["💰", "Finance"],
              ["📦", "Deliveries"],
              ["📅", "Meetings"],
              ["📝", "Follow-ups"],
            ].map(([icon, label]) => (
              <button
                key={label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:bg-slate-50"
              >
                <span className="text-2xl">{icon}</span>

                <div>
                  <p className="font-semibold text-slate-800">
                    {label}
                  </p>

                  <p className="text-sm text-slate-500">
                    View {label.toLowerCase()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Schedule for{" "}
                  {new Date(selectedDate).toLocaleDateString(
                    "en-ZA",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Tasks and appointments scheduled
                </p>
              </div>

              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {filteredTasks.length} events
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-500">
              Loading calendar...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No scheduled events for this date.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-4 p-6 transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800">
                        {task.title || "Untitled Task"}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority || "Medium"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadge(
                          task.task_type
                        )}`}
                      >
                        {task.task_type || "Task"}
                      </span>
                    </div>

                    <p className="text-slate-500">
                      {task.description || "No description"}
                    </p>

                    <div className="flex flex-wrap gap-5 text-sm text-slate-500">
                      <span>
                        👤 {task.assigned_user_name || "-"}
                      </span>

                      <span>
                        📌 Lead #{task.lead_id || "-"}
                      </span>

                      <span>
                        🕒{" "}
                        {task.due_date
                          ? new Date(
                              task.due_date
                            ).toLocaleTimeString("en-ZA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200">
                      Complete
                    </button>

                    <button className="rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200">
                      Reschedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}