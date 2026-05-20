"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type Task = {
  id: number;
  company_id: number;
  lead_id: number | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  title: string;
  description: string | null;
  task_type: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_by_name: string | null;
  completed_at: string | null;
  created_at: string | null;
};

export default function TasksPage() {
  const { profile } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Open");
  const [searchTerm, setSearchTerm] = useState("");

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
      console.error("Error loading tasks:", error.message);
      setTasks([]);
    } else {
      setTasks(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, [profile?.company_id, profile?.role, profile?.id]);

  async function markComplete(task: Task) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "Completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("company_id", profile?.company_id);

    if (error) {
      alert("Error completing task: " + error.message);
      return;
    }

    fetchTasks();
  }

  const filteredTasks = tasks.filter((task) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      task.title.toLowerCase().includes(search) ||
      (task.description || "").toLowerCase().includes(search) ||
      (task.assigned_user_name || "").toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "All" || (task.status || "Open") === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const overdueCount = tasks.filter((task) => {
    if (!task.due_date || task.status === "Completed") return false;
    return new Date(task.due_date) < new Date();
  }).length;

  const openCount = tasks.filter((task) => task.status !== "Completed").length;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
        <p className="text-slate-500">
          Manage follow-ups, callbacks and dealership task workflow
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Open Tasks</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {openCount}
          </h2>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Overdue</p>
          <h2 className="mt-2 text-3xl font-bold text-red-600">
            {overdueCount}
          </h2>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Total Tasks</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {tasks.length}
          </h2>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-5 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            type="text"
            placeholder="Search tasks, notes or assignee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-slate-300 p-3"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 p-3"
          >
            <option value="All">All Tasks</option>
            <option value="Open">Open</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        {loading ? (
          <div className="p-6 text-slate-500">Loading tasks...</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Task
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Assigned To
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Due
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Priority
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTasks.map((task) => {
                const isOverdue =
                  task.due_date &&
                  task.status !== "Completed" &&
                  new Date(task.due_date) < new Date();

                return (
                  <tr
                    key={task.id}
                    className={`border-t hover:bg-slate-50 ${
                      isOverdue ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {task.description}
                        </p>
                      )}
                      {task.lead_id && (
                        <Link
                          href={`/leads/${task.lead_id}`}
                          className="mt-2 inline-block text-sm text-blue-700 hover:underline"
                        >
                          Open linked lead
                        </Link>
                      )}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {task.assigned_user_name || "Unassigned"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleString("en-ZA")
                        : "-"}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                        {task.priority || "Medium"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-sm ${
                          task.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : isOverdue
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {task.status === "Completed"
                          ? "Completed"
                          : isOverdue
                          ? "Overdue"
                          : "Open"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {task.status !== "Completed" ? (
                        <button
                          onClick={() => markComplete(task)}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}