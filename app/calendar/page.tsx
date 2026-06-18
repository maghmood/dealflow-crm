"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  lead_id: number | null;
  customer_name?: string | null;
};

type SalesUser = {
  id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type LeadOption = {
  id: number;
  customer: string | null;
  vehicle: string | null;
  assigned_user_id: number | null;
};

const HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
const GRID_TEMPLATE = "80px repeat(7, minmax(165px, 1fr))";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);

  return current;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);

  const start = weekStart.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });

  const end = weekEnd.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${start} - ${end}`;
}

function taskStyle(type: string | null, overdue: boolean, dueSoon: boolean, completed: boolean) {
  if (completed) return "border-green-500 bg-green-100 text-green-950 opacity-80";
  if (overdue) return "border-red-500 bg-red-100 text-red-950";
  if (dueSoon) return "border-amber-500 bg-amber-100 text-amber-950";

  const styles: Record<string, string> = {
    Followup: "border-purple-500 bg-purple-100 text-purple-950",
    "Follow-up": "border-purple-500 bg-purple-100 text-purple-950",
    Call: "border-green-500 bg-green-100 text-green-950",
    Finance: "border-indigo-500 bg-indigo-100 text-indigo-950",
    Delivery: "border-teal-500 bg-teal-100 text-teal-950",
    Meeting: "border-yellow-500 bg-yellow-100 text-yellow-950",
    "Test Drive": "border-orange-500 bg-orange-100 text-orange-950",
    Appointment: "border-cyan-500 bg-cyan-100 text-cyan-950",
  };

  return styles[type || ""] || "border-blue-500 bg-blue-100 text-blue-950";
}

function priorityBadge(priority: string | null) {
  const styles: Record<string, string> = {
    Low: "bg-slate-100 text-slate-700",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-orange-100 text-orange-700",
    Urgent: "bg-red-100 text-red-700",
  };

  return styles[priority || "Medium"] || "bg-slate-100 text-slate-700";
}

function typeBadge(type: string | null) {
  const styles: Record<string, string> = {
    Followup: "bg-purple-100 text-purple-700",
    "Follow-up": "bg-purple-100 text-purple-700",
    Call: "bg-green-100 text-green-700",
    Finance: "bg-indigo-100 text-indigo-700",
    Delivery: "bg-teal-100 text-teal-700",
    Meeting: "bg-yellow-100 text-yellow-700",
    "Test Drive": "bg-orange-100 text-orange-700",
    Appointment: "bg-cyan-100 text-cyan-700",
  };

  return styles[type || ""] || "bg-slate-100 text-slate-700";
}

function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function buildSlotDateTime(day: Date, hour: number) {
  const date = new Date(day);
  date.setHours(hour, 0, 0, 0);
  return toDateTimeLocalValue(date);
}

function isTaskOverdue(task: CalendarTask) {
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date() && task.status !== "Completed";
}

function isTaskDueSoon(task: CalendarTask) {
  if (!task.due_date || task.status === "Completed") return false;

  const now = new Date().getTime();
  const due = new Date(task.due_date).getTime();
  const oneHour = 60 * 60 * 1000;

  return due >= now && due <= now + oneHour;
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

export default function CalendarPage() {
  const { profile } = useAuth();

  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState("Appointment");
  const [eventPriority, setEventPriority] = useState("Medium");
  const [eventDateTime, setEventDateTime] = useState("");
  const [eventLeadId, setEventLeadId] = useState<number | "">("");
  const [eventAssignedUserId, setEventAssignedUserId] = useState<number | "">("");
  const [savingEvent, setSavingEvent] = useState(false);

  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const [typeFilter, setTypeFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Open");

  async function fetchTasks() {
    if (!profile?.company_id) return;

    setLoading(true);

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("company_id", profile.company_id)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading calendar:", error.message);
      setTasks([]);
      setLoading(false);
      return;
    }

    const baseTasks = Array.isArray(data)
      ? (data as CalendarTask[])
      : [];

    const leadIds = Array.from(
      new Set(
        baseTasks
          .map((task) => task.lead_id)
          .filter((leadId): leadId is number => Boolean(leadId))
      )
    );

    let customerMap = new Map<number, string>();

    if (leadIds.length > 0) {
      const { data: leadData, error: leadError } =
        await supabase
          .from("leads")
          .select("id, customer")
          .eq("company_id", profile.company_id)
          .in("id", leadIds);

      if (leadError) {
        console.error(
          "Error loading calendar customer names:",
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

  async function fetchSalesUsers() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", profile.company_id)
      .in("role", ["Sales", "Manager", "Admin"])
      .eq("status", "Active")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading sales users:", error.message);
      setSalesUsers([]);
      return;
    }

    setSalesUsers(Array.isArray(data) ? data : []);
  }

  async function fetchLeads() {
    if (!profile?.company_id) return;

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
      console.error("Error loading leads:", error.message);
      setLeads([]);
      return;
    }

    setLeads(Array.isArray(data) ? data : []);
  }

  async function addLeadActivity(
    leadId: number | null,
    title: string,
    description: string,
    activityType: string,
    color: string
  ) {
    if (!leadId || !profile?.company_id) return;

    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      title,
      description,
      activity_type: activityType,
      color,
      company_id: profile.company_id,
    });

    if (error) {
      console.error("Error saving calendar activity:", error.message);
    }
  }

  function resetEventForm() {
    setEventTitle("");
    setEventDescription("");
    setEventType("Appointment");
    setEventPriority("Medium");
    setEventDateTime("");
    setEventLeadId("");
    setEventAssignedUserId("");
    setSavingEvent(false);
  }

  function openCreateModalForSlot(day?: Date, hour?: number) {
    resetEventForm();
    setEventAssignedUserId(profile?.id || "");

    if (day && typeof hour === "number") {
      setEventDateTime(buildSlotDateTime(day, hour));
    }

    setShowCreateModal(true);
  }

  async function createCalendarEvent() {
    if (!profile?.company_id) return;

    if (!eventTitle.trim() || !eventDateTime) {
      alert("Please enter an event title and date/time.");
      return;
    }

    setSavingEvent(true);

    const selectedUser =
      salesUsers.find((user) => user.id === Number(eventAssignedUserId)) ||
      salesUsers.find((user) => user.id === profile.id);

    const selectedLead = leads.find((lead) => lead.id === Number(eventLeadId));
    const selectedLeadId = eventLeadId === "" ? null : Number(eventLeadId);
    const dueDateForDatabase = toDatabaseTimestamp(eventDateTime);

    if (selectedLeadId && selectedUser) {
      const { data, error } = await supabase.rpc(
        "upsert_workflow_task",
        {
          p_lead_id: selectedLeadId,
          p_assigned_user_id: selectedUser.id,
          p_title: eventTitle.trim(),
          p_description:
            eventDescription.trim() ||
            (selectedLead
              ? `${eventType} for ${selectedLead.customer || "customer"}${
                  selectedLead.vehicle ? ` • ${selectedLead.vehicle}` : ""
                }`
              : null),
          p_task_type: eventType,
          p_priority: eventPriority,
          p_due_date: dueDateForDatabase,
          p_task_scope: "Sales",
          p_task_reason: workflowReasonForTaskType(eventType),
          p_related_record_type: "lead",
          p_related_record_id: selectedLeadId,
          p_use_dedupe: true,
        }
      );

      if (error) {
        alert("Error saving calendar event: " + error.message);
        setSavingEvent(false);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      const action = result?.task_action || "saved";

      await addLeadActivity(
        selectedLeadId,
        action === "created"
          ? "Calendar Event Created"
          : action === "reopened"
          ? "Calendar Event Reopened"
          : "Calendar Event Updated",
        `${eventType}: ${eventTitle.trim()} scheduled for ${new Date(
          dueDateForDatabase
        ).toLocaleString("en-ZA")}`,
        "calendar",
        action === "created" ? "blue" : "orange"
      );

      resetEventForm();
      setShowCreateModal(false);
      await fetchTasks();
      alert(
        action === "created"
          ? "Calendar event created successfully."
          : action === "reopened"
          ? "Existing matching event reopened and updated."
          : "Existing matching event updated."
      );

      return;
    }

    const { error } = await supabase.from("tasks").insert({
      company_id: profile.company_id,
      lead_id: null,
      assigned_user_id: selectedUser?.id || profile.id,
      assigned_user_name:
        selectedUser?.full_name || selectedUser?.email || profile.full_name,
      title: eventTitle.trim(),
      description: eventDescription.trim() || null,
      task_type: eventType,
      status: "Open",
      priority: eventPriority,
      due_date: dueDateForDatabase,
      created_by_id: profile.id,
      created_by_name: profile.full_name,
    });

    if (error) {
      alert("Error creating calendar event: " + error.message);
      setSavingEvent(false);
      return;
    }

    resetEventForm();
    setShowCreateModal(false);
    await fetchTasks();
  }

  async function markComplete(taskId: number) {
    if (!profile?.company_id) return;

    const taskToComplete = tasks.find((task) => task.id === taskId) || selectedTask;

    const { error } = await supabase
      .from("tasks")
      .update({ status: "Completed" })
      .eq("id", taskId)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error completing task: " + error.message);
      return;
    }

    await addLeadActivity(
      taskToComplete?.lead_id || null,
      "Calendar Event Completed",
      `${taskToComplete?.task_type || "Task"} completed: ${
        taskToComplete?.title || "Untitled event"
      }`,
      "calendar",
      "green"
    );

    setSelectedTask(null);
    fetchTasks();
  }

  async function updateTaskDueDate(task: CalendarTask, newDateTime: string, source: "reschedule" | "drag") {
    if (!profile?.company_id) return;

    const oldDate = task.due_date
      ? new Date(task.due_date).toLocaleString("en-ZA")
      : "No previous date";

    const databaseDateTime = toDatabaseTimestamp(newDateTime);

    const { error } = await supabase
      .from("tasks")
      .update({ due_date: databaseDateTime })
      .eq("id", task.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error rescheduling task: " + error.message);
      return;
    }

    await addLeadActivity(
      task.lead_id,
      "Calendar Event Rescheduled",
      `${task.task_type || "Task"} "${task.title || "Untitled event"}" moved from ${oldDate} to ${new Date(
        databaseDateTime
      ).toLocaleString("en-ZA")}${source === "drag" ? " via drag-and-drop" : ""}.`,
      "calendar",
      "orange"
    );

    setSelectedTask(null);
    setShowRescheduleModal(false);
    setRescheduleDateTime("");
    fetchTasks();
  }

  async function rescheduleTask() {
    if (!selectedTask) return;

    if (!rescheduleDateTime) {
      alert("Please choose a new date/time.");
      return;
    }

    await updateTaskDueDate(selectedTask, rescheduleDateTime, "reschedule");
  }

  async function handleDropOnSlot(day: Date, hour: number) {
    if (!draggingTaskId) return;

    const draggedTask = tasks.find((task) => task.id === draggingTaskId);

    if (!draggedTask) {
      setDraggingTaskId(null);
      return;
    }

    const newDateTime = buildSlotDateTime(day, hour);
    setDraggingTaskId(null);

    await updateTaskDueDate(draggedTask, newDateTime, "drag");
  }

  useEffect(() => {
    fetchTasks();
    fetchSalesUsers();
    fetchLeads();
  }, [profile?.company_id, profile?.role, profile?.id]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const todayKey = dateKey(new Date());

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === "Open" && task.status === "Completed") return false;
      if (statusFilter === "Completed" && task.status !== "Completed") return false;

      if (typeFilter !== "All" && (task.task_type || "Task") !== typeFilter) {
        return false;
      }

      if (ownerFilter === "Mine" && task.assigned_user_id !== profile?.id) {
        return false;
      }

      return true;
    });
  }, [tasks, typeFilter, ownerFilter, statusFilter, profile?.id]);

  const weekTasks = useMemo(() => {
    const start = dateKey(weekDays[0]);
    const end = dateKey(weekDays[6]);

    return visibleTasks.filter((task) => {
      if (!task.due_date) return false;

      const key = dateKey(new Date(task.due_date));

      return key >= start && key <= end;
    });
  }, [visibleTasks, weekDays]);

  const todayTasks = visibleTasks.filter((task) => {
    if (!task.due_date) return false;
    return dateKey(new Date(task.due_date)) === todayKey;
  });

  const overdueTasks = visibleTasks.filter(isTaskOverdue);
  const dueSoonTasks = visibleTasks.filter(isTaskDueSoon);

  const upcomingTasks = visibleTasks.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date) > new Date() && task.status !== "Completed";
  });

  const completedTasks = visibleTasks.filter((task) => task.status === "Completed");

  const availableTypes = Array.from(
    new Set(tasks.map((task) => task.task_type || "Task").filter(Boolean))
  ).sort();

  function tasksForSlot(day: Date, hour: number) {
    return weekTasks.filter((task) => {
      if (!task.due_date) return false;

      const taskDate = new Date(task.due_date);

      return dateKey(taskDate) === dateKey(day) && taskDate.getHours() === hour;
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
            <p className="text-slate-500">
              Outlook-style weekly schedule for CRM tasks, appointments and test drives
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ‹ Previous
            </button>

            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-lg brand-primary-bg px-4 py-2 text-sm font-semibold text-white"
            >
              This Week
            </button>

            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Next ›
            </button>

            <button
              onClick={() => openCreateModalForSlot()}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
            >
              + Create Event
            </button>
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
        >
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Today</p>
            <h2 className="mt-1 text-2xl font-bold text-blue-700">
              {todayTasks.length}
            </h2>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Due in 1 Hour</p>
            <h2 className="mt-1 text-2xl font-bold text-amber-700">
              {dueSoonTasks.length}
            </h2>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Overdue</p>
            <h2 className="mt-1 text-2xl font-bold text-red-700">
              {overdueTasks.length}
            </h2>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Upcoming</p>
            <h2 className="mt-1 text-2xl font-bold text-orange-700">
              {upcomingTasks.length}
            </h2>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Completed</p>
            <h2 className="mt-1 text-2xl font-bold text-green-700">
              {completedTasks.length}
            </h2>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-bold text-slate-800">Calendar Filters</h2>
              <p className="text-sm text-slate-500">
                Filter the schedule by type, owner and status.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option>All</option>
                {availableTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>

              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option>All</option>
                <option>Mine</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option>Open</option>
                <option>All</option>
                <option>Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {formatWeekRange(weekStart)}
              </h2>
              <p className="text-sm text-slate-500">
                Drag tasks between time slots to reschedule. Click an empty slot to create an event.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {weekTasks.length} item{weekTasks.length === 1 ? "" : "s"} this week
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading calendar...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1240px]">
                <div
                  className="grid border-b border-slate-200"
                  style={{ gridTemplateColumns: GRID_TEMPLATE }}
                >
                  <div className="bg-slate-50 p-3 text-xs font-semibold uppercase text-slate-500">
                    Time
                  </div>

                  {weekDays.map((day) => {
                    const isToday = dateKey(day) === todayKey;

                    return (
                      <div
                        key={dateKey(day)}
                        className={`border-l border-slate-200 p-3 ${
                          isToday ? "bg-blue-200" : "bg-blue-50"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase text-slate-700">
                          {day.toLocaleDateString("en-ZA", {
                            weekday: "long",
                          })}
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {day.getDate()}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid min-h-[112px] border-b border-slate-200"
                    style={{ gridTemplateColumns: GRID_TEMPLATE }}
                  >
                    <div className="border-r border-slate-200 bg-slate-50 px-3 py-3 text-right text-sm font-semibold text-slate-500">
                      {pad(hour)}:00
                    </div>

                    {weekDays.map((day) => {
                      const slotTasks = tasksForSlot(day, hour);

                      return (
                        <div
                          key={`${dateKey(day)}-${hour}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropOnSlot(day, hour)}
                          onDoubleClick={() => openCreateModalForSlot(day, hour)}
                          className={`relative border-l border-slate-100 bg-white p-2 hover:bg-slate-50 ${
                            draggingTaskId ? "ring-1 ring-blue-100" : ""
                          }`}
                        >
                          <button
                            onClick={() => openCreateModalForSlot(day, hour)}
                            className="absolute right-2 top-2 hidden rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 md:block"
                            title="Create event in this slot"
                          >
                            +
                          </button>

                          <div className="space-y-2 pr-5">
                            {slotTasks.map((task) => {
                              const taskDate = task.due_date
                                ? new Date(task.due_date)
                                : null;

                              const overdue = isTaskOverdue(task);
                              const dueSoon = isTaskDueSoon(task);
                              const completed = task.status === "Completed";

                              return (
                                <button
                                  key={task.id}
                                  draggable
                                  onDragStart={() => setDraggingTaskId(task.id)}
                                  onDragEnd={() => setDraggingTaskId(null)}
                                  onClick={() => setSelectedTask(task)}
                                  className={`w-full cursor-grab rounded-md border border-l-4 px-3 py-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${taskStyle(
                                    task.task_type,
                                    overdue,
                                    dueSoon,
                                    completed
                                  )}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="line-clamp-2 font-bold leading-snug">
                                      {task.title || "Untitled Task"}
                                    </p>

                                    <span className="shrink-0 text-[10px] font-semibold opacity-80">
                                      {taskDate
                                        ? taskDate.toLocaleTimeString("en-ZA", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : ""}
                                    </span>
                                  </div>

                                  <p className="mt-1 line-clamp-1 opacity-80">
                                    {task.task_type || "Task"} •{" "}
                                    {task.customer_name || "General"} •{" "}
                                    {task.assigned_user_name || "Unassigned"}
                                  </p>

                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {dueSoon && (
                                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                        Due soon
                                      </span>
                                    )}

                                    {overdue && (
                                      <span className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-900">
                                        Overdue
                                      </span>
                                    )}

                                    {task.lead_id && (
                                      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
                                        {task.customer_name || `Lead #${task.lead_id}`}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {selectedTask.title || "Untitled Task"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Calendar item details
                </p>
              </div>

              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadge(
                  selectedTask.priority
                )}`}
              >
                {selectedTask.priority || "Medium"}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadge(
                  selectedTask.task_type
                )}`}
              >
                {selectedTask.task_type || "Task"}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {selectedTask.status || "Open"}
              </span>

              {isTaskDueSoon(selectedTask) && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Due in 1 hour
                </span>
              )}

              {isTaskOverdue(selectedTask) && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Overdue
                </span>
              )}
            </div>

            <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedTask.description || "No description captured."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Date / Time
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedTask.due_date
                      ? new Date(selectedTask.due_date).toLocaleString("en-ZA")
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Assigned To
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedTask.assigned_user_name || "Unassigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Lead
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedTask.customer_name ||
                      (selectedTask.lead_id ? `Lead #${selectedTask.lead_id}` : "-")}
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
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setRescheduleDateTime(
                    selectedTask.due_date
                      ? toDateTimeLocalInput(selectedTask.due_date)
                      : ""
                  );
                  setShowRescheduleModal(true);
                }}
                className="rounded-xl bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200"
              >
                Reschedule
              </button>

              {selectedTask.lead_id && (
                <Link
                  href={`/leads/${selectedTask.lead_id}`}
                  className="rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                >
                  Open Lead
                </Link>
              )}

              {selectedTask.status !== "Completed" && (
                <button
                  onClick={() => markComplete(selectedTask.id)}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Create Calendar Event
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Schedule a follow-up, test drive, appointment or finance task.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetEventForm();
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Title
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Test drive with customer"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option>Appointment</option>
                  <option>Test Drive</option>
                  <option>Follow-up</option>
                  <option>Call</option>
                  <option>Finance</option>
                  <option>Delivery</option>
                  <option>Meeting</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Priority
                </label>
                <select
                  value={eventPriority}
                  onChange={(e) => setEventPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Date / Time
                </label>
                <input
                  type="datetime-local"
                  value={eventDateTime}
                  onChange={(e) => setEventDateTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Assign To
                </label>
                <select
                  value={eventAssignedUserId}
                  onChange={(e) =>
                    setEventAssignedUserId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value="">Assign to me</option>
                  {salesUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Link to Lead
                </label>
                <select
                  value={eventLeadId}
                  onChange={(e) =>
                    setEventLeadId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value="">No lead selected</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      #{lead.id} • {lead.customer || "Unknown Customer"}
                      {lead.vehicle ? ` • ${lead.vehicle}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">
                  Notes
                </label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Add appointment notes..."
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetEventForm();
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={createCalendarEvent}
                disabled={savingEvent}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {savingEvent ? "Saving..." : "Save Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRescheduleModal && selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Reschedule Event
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose a new date and time for this calendar item.
            </p>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-600">
                New Date / Time
              </label>
              <input
                type="datetime-local"
                value={rescheduleDateTime}
                onChange={(e) => setRescheduleDateTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleDateTime("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={rescheduleTask}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
              >
                Save New Time
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
