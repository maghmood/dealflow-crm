"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import PageAccessGuard from "@/components/PageAccessGuard";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";
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
  is_automated: boolean;
  automation_type: string | null;
  automation_key: string | null;
  automation_generated_at: string | null;
  automation_last_checked_at: string | null;
  customer_name?: string | null;
};

type LeadOption = {
  id: number;
  customer: string | null;
  vehicle: string | null;
  assigned_user_id: number | null;
};

type AssignableUser = {
  id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
};


function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDatabaseTimestamp(value: string) {
  return new Date(value).toISOString();
}

function toDateTimeLocalInput(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function workflowReasonForTaskType(taskType: string) {
  const normalized = taskType.trim().toLowerCase();

  if (normalized === "call") return "CALLBACK";
  if (normalized === "callback") return "CALLBACK";
  if (normalized === "follow-up" || normalized === "followup") {
    return "CUSTOMER_FOLLOW_UP";
  }
  if (normalized === "test drive") return "TEST_DRIVE";
  if (normalized === "appointment") return "APPOINTMENT";
  if (normalized === "delivery") return "DELIVERY";
  if (normalized === "finance") return "FINANCE_FOLLOW_UP";
  if (normalized === "meeting") return "MEETING";

  return normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "GENERAL";
}

export default function TasksPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("Open");
  const [searchTerm, setSearchTerm] = useState("");
  const [automationFilter, setAutomationFilter] = useState("All");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("Follow-up");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskLeadId, setTaskLeadId] = useState<number | "">("");
  const [taskAssignedUserId, setTaskAssignedUserId] =
    useState<number | "">("");

  const highlightedTaskId = Number(searchParams.get("taskId")) || null;

  const canChooseAssignee =
    profile?.role === "Admin" || profile?.role === "Manager";

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

    if (profile.role === "Finance") {
      query = query
        .eq("assigned_user_id", profile.id)
        .eq("task_scope", "Finance");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading tasks:", error.message);
      setTasks([]);
      setLoading(false);
      return;
    }

    const baseTasks = Array.isArray(data) ? (data as Task[]) : [];
    const leadIds = Array.from(
      new Set(
        baseTasks
          .map((task) => task.lead_id)
          .filter((leadId): leadId is number => Boolean(leadId))
      )
    );

    let customerMap = new Map<number, string>();

    if (leadIds.length > 0) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("id, customer")
        .eq("company_id", profile.company_id)
        .in("id", leadIds);

      if (leadError) {
        console.error(
          "Error loading task customer names:",
          leadError.message
        );
      } else {
        customerMap = new Map(
          (leadData || []).map((lead: any) => [
            Number(lead.id),
            lead.customer || "Unknown Customer",
          ])
        );
      }
    }

    setTasks(
      baseTasks.map((task) => ({
        ...task,
        customer_name: task.lead_id
          ? customerMap.get(task.lead_id) || null
          : null,
      }))
    );

    setLoading(false);
  }

  async function fetchLeads() {
    if (!profile?.company_id) return;

    if (profile.role === "Finance") {
      setLeads([]);
      return;
    }

    let query = supabase
      .from("leads")
      .select("id, customer, vehicle, assigned_user_id")
      .eq("company_id", profile.company_id)
      .order("id", { ascending: false })
      .limit(300);

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading task leads:", error.message);
      setLeads([]);
      return;
    }

    setLeads(Array.isArray(data) ? data : []);
  }

  async function fetchAssignableUsers() {
    if (!profile?.company_id || !canChooseAssignee) {
      setAssignableUsers([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", profile.company_id)
      .eq("status", "Active")
      .in("role", ["Admin", "Manager", "Sales", "Finance"])
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading task assignees:", error.message);
      setAssignableUsers([]);
      return;
    }

    setAssignableUsers(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!profile?.company_id) return;

    void Promise.all([
      fetchTasks(),
      fetchLeads(),
      fetchAssignableUsers(),
    ]);
  }, [profile?.company_id, profile?.role, profile?.id]);

  useEffect(() => {
    if (!highlightedTaskId || loading) return;

    const element = document.getElementById(
      `task-row-${highlightedTaskId}`
    );

    if (element) {
      window.setTimeout(() => {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [highlightedTaskId, loading, tasks]);

  function openCreateTaskModal() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskType("Follow-up");
    setTaskPriority("Medium");
    setTaskDueDate("");
    setTaskLeadId("");
    setTaskAssignedUserId(
      profile?.role === "Sales" ? profile.id : ""
    );
    setShowCreateModal(true);
  }

  async function createTask() {
    if (!profile?.company_id || !profile?.id) return;

    if (!taskTitle.trim()) {
      alert("Please enter a task title.");
      return;
    }

    if (!taskDueDate) {
      alert("Please select a due date and time.");
      return;
    }

    let assignee: AssignableUser | null = null;

    if (!canChooseAssignee) {
      assignee = {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      };
    } else {
      assignee =
        assignableUsers.find(
          (user) => user.id === Number(taskAssignedUserId)
        ) || null;
    }

    if (!assignee) {
      alert("Please select an assignee.");
      return;
    }

    const selectedLead =
      leads.find((lead) => lead.id === Number(taskLeadId)) || null;

    setSavingTask(true);

    const dueDateForDatabase = toDatabaseTimestamp(taskDueDate);

    if (selectedLead) {
      const taskScope =
        assignee.role === "Finance" || taskType === "Finance"
          ? "Finance"
          : "Sales";

      const { data, error } = await supabase.rpc(
        "upsert_workflow_task",
        {
          p_lead_id: selectedLead.id,
          p_assigned_user_id: assignee.id,
          p_title: taskTitle.trim(),
          p_description: taskDescription.trim() || null,
          p_task_type: taskType,
          p_priority: taskPriority,
          p_due_date: dueDateForDatabase,
          p_task_scope: taskScope,
          p_task_reason: workflowReasonForTaskType(taskType),
          p_related_record_type: "lead",
          p_related_record_id: selectedLead.id,
          p_use_dedupe: true,
        }
      );

      setSavingTask(false);

      if (error) {
        alert("Error saving task: " + error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      const action = result?.task_action || "saved";

      await supabase.from("lead_activities").insert({
        company_id: profile.company_id,
        lead_id: selectedLead.id,
        title:
          action === "created"
            ? "Task Created"
            : action === "reopened"
            ? "Task Reopened"
            : "Task Updated",
        description: `${taskTitle.trim()} assigned to ${
          assignee.full_name || assignee.email || "user"
        } • Due: ${new Date(dueDateForDatabase).toLocaleString("en-ZA")}`,
        activity_type: "task",
        color: action === "created" ? "blue" : "orange",
      });

      setShowCreateModal(false);
      await fetchTasks();
      alert(
        action === "created"
          ? "Task created successfully."
          : action === "reopened"
          ? "Existing matching task reopened and updated."
          : "Existing matching task updated."
      );

      return;
    }

    const { error } = await supabase.from("tasks").insert({
      company_id: profile.company_id,
      lead_id: null,
      assigned_user_id: assignee.id,
      assigned_user_name:
        assignee.full_name || assignee.email || "Unassigned",
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      task_type: taskType,
      status: "Open",
      priority: taskPriority,
      due_date: dueDateForDatabase,
      created_by_id: profile.id,
      created_by_name:
        profile.full_name || profile.email || "Unknown User",
      is_automated: false,
    });

    setSavingTask(false);

    if (error) {
      alert("Error creating task: " + error.message);
      return;
    }

    setShowCreateModal(false);
    await fetchTasks();
    alert("General task created successfully.");
  }

  function openTaskDetails(task: Task) {
    setSelectedTask(task);
  }

  async function rescheduleTask() {
    if (
      !selectedTask ||
      !profile?.company_id ||
      !rescheduleDateTime
    ) {
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        due_date: toDatabaseTimestamp(rescheduleDateTime),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error rescheduling task: " + error.message);
      return;
    }

    if (selectedTask.lead_id) {
      await supabase.from("lead_activities").insert({
        company_id: profile.company_id,
        lead_id: selectedTask.lead_id,
        title: "Task Rescheduled",
        description: `${selectedTask.title} moved to ${new Date(
          toDatabaseTimestamp(rescheduleDateTime)
        ).toLocaleString("en-ZA")}`,
        activity_type: "task",
        color: "orange",
      });
    }

    setShowRescheduleModal(false);
    setRescheduleDateTime("");
    setSelectedTask(null);
    await fetchTasks();
  }

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

    if (selectedTask?.id === task.id) {
      setSelectedTask(null);
    }

    await fetchTasks();

    /*
     * Tell DashboardLayout to refresh the notification bell
     * immediately after the task is completed.
     */
    window.dispatchEvent(
      new CustomEvent("dealflow-task-updated", {
        detail: {
          taskId: task.id,
          status: "Completed",
        },
      })
    );
  }

  const filteredTasks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search) ||
        (task.description || "").toLowerCase().includes(search) ||
        (task.assigned_user_name || "").toLowerCase().includes(search) ||
        (task.customer_name || "").toLowerCase().includes(search) ||
        (task.automation_type || "").toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" ||
        (task.status || "Open") === statusFilter;

      const matchesAutomation =
        automationFilter === "All" ||
        (automationFilter === "Automated" && task.is_automated) ||
        (automationFilter === "Manual" && !task.is_automated);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAutomation
      );
    });
  }, [tasks, searchTerm, statusFilter, automationFilter]);

  const overdueCount = tasks.filter((task) => {
    if (!task.due_date || task.status === "Completed") return false;
    return new Date(task.due_date) < new Date();
  }).length;

  const openCount = tasks.filter(
    (task) => task.status !== "Completed"
  ).length;

  const automatedOpenCount = tasks.filter(
    (task) =>
      task.is_automated &&
      task.status !== "Completed"
  ).length;

  const manualOpenCount = tasks.filter(
    (task) =>
      !task.is_automated &&
      task.status !== "Completed"
  ).length;

  return (
    <DashboardLayout>
      <PageAccessGuard module="tasks">
        <ReadOnlyNotice />

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Tasks
            </h1>

            <p className="text-slate-500">
              Manage follow-ups, callbacks and dealership task workflow
            </p>
          </div>

          <WriteAccessGuard>
            <button
              type="button"
              onClick={openCreateTaskModal}
              className="rounded-xl brand-primary-bg px-5 py-3 font-semibold text-white"
            >
              + Create Task
            </button>
          </WriteAccessGuard>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Open Tasks", openCount, "text-slate-800"],
            ["Overdue", overdueCount, "text-red-600"],
            ["Total Tasks", tasks.length, "text-slate-800"],
            ["Automated Open", automatedOpenCount, "text-blue-700"],
            ["Manual Open", manualOpenCount, "text-slate-800"],
          ].map(([label, value, className]) => (
            <div
              key={String(label)}
              className="rounded-xl bg-white p-6 shadow"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>

              <h2
                className={`mt-2 text-3xl font-bold ${className}`}
              >
                {value}
              </h2>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              type="text"
              placeholder="Search task, customer, notes or assignee..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              className="rounded-lg border border-slate-300 p-3"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-lg border border-slate-300 p-3"
            >
              <option value="All">All Tasks</option>
              <option value="Open">Open</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              value={automationFilter}
              onChange={(event) =>
                setAutomationFilter(event.target.value)
              }
              className="rounded-lg border border-slate-300 p-3"
            >
              <option value="All">All Sources</option>
              <option value="Automated">Automated Tasks</option>
              <option value="Manual">Manual Tasks</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          {loading ? (
            <div className="p-6 text-slate-500">
              Loading tasks...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Task
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Customer
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

                    const highlighted =
                      highlightedTaskId === task.id;

                    return (
                      <tr
                        id={`task-row-${task.id}`}
                        key={task.id}
                        className={`border-t transition ${
                          highlighted
                            ? "bg-yellow-100 ring-2 ring-inset ring-yellow-400"
                            : isOverdue
                            ? "bg-red-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-800">
                              {task.title}
                            </p>

                            {task.is_automated && (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                Automated
                              </span>
                            )}

                            {highlighted && (
                              <span className="rounded-full bg-yellow-200 px-2 py-1 text-[11px] font-semibold text-yellow-900">
                                Selected Notification
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}

                          {task.is_automated &&
                            task.automation_type && (
                              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                                Rule:{" "}
                                {task.automation_type
                                  .replaceAll("_", " ")
                                  .toLowerCase()}
                              </p>
                            )}
                        </td>

                        <td className="px-6 py-4">
                          {task.lead_id ? (
                            <Link
                              href={`/leads/${task.lead_id}`}
                              className="font-semibold text-blue-700 hover:underline"
                            >
                              {task.customer_name ||
                                "Open linked customer"}
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              General / Unlinked
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {task.assigned_user_name || "Unassigned"}
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {task.due_date
                            ? new Date(task.due_date).toLocaleString(
                                "en-ZA"
                              )
                            : "-"}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${
                              task.priority === "Urgent"
                                ? "bg-red-100 text-red-700"
                                : task.priority === "High"
                                ? "bg-orange-100 text-orange-700"
                                : task.priority === "Low"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
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
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openTaskDetails(task)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              View
                            </button>

                            {task.status !== "Completed" ? (
                              <WriteAccessGuard>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void markComplete(task)
                                  }
                                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                                >
                                  Complete
                                </button>
                              </WriteAccessGuard>
                            ) : (
                              <span className="rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                                Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        No tasks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {selectedTask.title || "Task Details"}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-blue-700">
                    {selectedTask.customer_name ||
                      "General / Unlinked Task"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedTask.priority === "Urgent"
                      ? "bg-red-100 text-red-700"
                      : selectedTask.priority === "High"
                      ? "bg-orange-100 text-orange-700"
                      : selectedTask.priority === "Low"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {selectedTask.priority || "Medium"}
                </span>

                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  {selectedTask.task_type || "Task"}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedTask.status === "Completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {selectedTask.status || "Open"}
                </span>

                {selectedTask.due_date &&
                  selectedTask.status !== "Completed" &&
                  new Date(selectedTask.due_date) < new Date() && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Overdue
                    </span>
                  )}

                {selectedTask.is_automated && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Automated
                  </span>
                )}
              </div>

              <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Description
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {selectedTask.description ||
                      "No description captured."}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Date / Time
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTask.due_date
                        ? new Date(
                            selectedTask.due_date
                          ).toLocaleString("en-ZA")
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Assigned To
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTask.assigned_user_name ||
                        "Unassigned"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Customer / Lead
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTask.lead_id
                        ? `${selectedTask.customer_name ||
                            "Customer"} • Lead #${
                            selectedTask.lead_id
                          }`
                        : "General / Unlinked"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Task ID
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      #{selectedTask.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Created By
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTask.created_by_name || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Source
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTask.is_automated
                        ? selectedTask.automation_type
                            ?.replaceAll("_", " ")
                            .toLowerCase() ||
                          "Automated task"
                        : "Manual task"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

                {selectedTask.status !== "Completed" && (
                  <WriteAccessGuard>
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleDateTime(
                          selectedTask.due_date
                            ? selectedTask.due_date.slice(0, 16)
                            : ""
                        );
                        setShowRescheduleModal(true);
                      }}
                      className="rounded-xl bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                    >
                      Reschedule
                    </button>
                  </WriteAccessGuard>
                )}

                {selectedTask.lead_id && (
                  <Link
                    href={`/leads/${selectedTask.lead_id}`}
                    className="rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                  >
                    Open Lead
                  </Link>
                )}

                {selectedTask.status !== "Completed" && (
                  <WriteAccessGuard>
                    <button
                      type="button"
                      onClick={() =>
                        void markComplete(selectedTask)
                      }
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      Mark Complete
                    </button>
                  </WriteAccessGuard>
                )}
              </div>
            </div>
          </div>
        )}

        {showRescheduleModal && selectedTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-slate-800">
                Reschedule Task
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose a new date and time for this task.
              </p>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-600">
                  New Date / Time
                </label>

                <input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(event) =>
                    setRescheduleDateTime(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleDateTime("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void rescheduleTask()}
                  disabled={!rescheduleDateTime}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  Save New Time
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-slate-800">
                Create Task
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Link the task to an existing customer or create a general unlinked task.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Task Title
                  </label>

                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(event) =>
                      setTaskTitle(event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Task Type
                  </label>

                  <select
                    value={taskType}
                    onChange={(event) =>
                      setTaskType(event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"
                  >
                    <option>Follow-up</option>
                    <option>Call</option>
                    <option>Appointment</option>
                    <option>Test Drive</option>
                    <option>Finance</option>
                    <option>Delivery</option>
                    <option>Meeting</option>
                    <option>General</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Priority
                  </label>

                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Due Date / Time
                  </label>

                  <input
                    type="datetime-local"
                    value={taskDueDate}
                    onChange={(event) =>
                      setTaskDueDate(event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Link to Customer
                  </label>

                  <select
                    value={taskLeadId}
                    onChange={(event) =>
                      setTaskLeadId(
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"
                  >
                    <option value="">
                      General / Unlinked Task
                    </option>

                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        #{lead.id} •{" "}
                        {lead.customer || "Unknown Customer"}
                        {lead.vehicle
                          ? ` • ${lead.vehicle}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Assign To
                  </label>

                  {canChooseAssignee ? (
                    <select
                      value={taskAssignedUserId}
                      onChange={(event) =>
                        setTaskAssignedUserId(
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"
                    >
                      <option value="">
                        Select assignee...
                      </option>

                      {assignableUsers.map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.full_name || user.email}
                          {user.role ? ` (${user.role})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium text-slate-700">
                      {profile?.full_name ||
                        profile?.email ||
                        "Current User"}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Description / Notes
                  </label>

                  <textarea
                    value={taskDescription}
                    onChange={(event) =>
                      setTaskDescription(event.target.value)
                    }
                    className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={savingTask}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void createTask()}
                  disabled={savingTask}
                  className="rounded-xl brand-primary-bg px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {savingTask ? "Saving..." : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageAccessGuard>
    </DashboardLayout>
  );
}
