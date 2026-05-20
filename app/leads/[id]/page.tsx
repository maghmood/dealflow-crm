"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

type SalesUser = {
  id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Lead = {
  id: number;
  customer: string;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  status: string | null;
  salesperson: string | null;
  finance: string | null;
  budget: string | null;
  source: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
};

type Activity = {
  id: number;
  lead_id: number;
  title: string;
  description: string | null;
  activity_type: string | null;
  color: string | null;
  created_at: string;
};

type WhatsAppDbMessage = {
  id: number;
  sender_type: "customer" | "user";
  sender_name: string | null;
  message: string;
  created_at: string;
};

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = Number(params.id);
  const { profile } = useAuth();

  const whatsappSectionRef = useRef<HTMLDivElement | null>(null);
  const whatsappInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<number | "">("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [financeApplicationId, setFinanceApplicationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppDbMessage[]>([]);
  const [whatsappInput, setWhatsappInput] = useState("");
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const [showCallModal, setShowCallModal] = useState(false);
  const [callOutcome, setCallOutcome] = useState("");
  const [callNotes, setCallNotes] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskAssignedUserId, setTaskAssignedUserId] = useState<number | "">("");

  const [leadStatus, setLeadStatus] = useState("New Lead");
  const [timeline, setTimeline] = useState<Activity[]>([]);

  const [vehiclePrice, setVehiclePrice] = useState("429900");
  const [deposit, setDeposit] = useState("40000");
  const [interestRate, setInterestRate] = useState("13.5");
  const [termMonths, setTermMonths] = useState("72");

  const priceNumber = Number(vehiclePrice) || 0;
  const depositNumber = Number(deposit) || 0;
  const rateNumber = Number(interestRate) || 0;
  const termNumber = Number(termMonths) || 1;

  const financeAmount = Math.max(priceNumber - depositNumber, 0);
  const monthlyRate = rateNumber / 100 / 12;

  const estimatedInstallment =
    monthlyRate > 0
      ? (financeAmount * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -termNumber))
      : financeAmount / termNumber;

  function normalizePhone(phone: string | null) {
    if (!phone) return "";

    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.startsWith("0")) {
      cleaned = "27" + cleaned.slice(1);
    }

    return cleaned;
  }

  async function fetchWhatsappMessages() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading WhatsApp messages:", error.message);
      setWhatsappMessages([]);
      return;
    }

    setWhatsappMessages(Array.isArray(data) ? data : []);
  }

  async function sendWhatsappMessage() {
    if (!lead || !profile?.company_id) return;

    const to = normalizePhone(lead.phone);

    if (!to) {
      alert("Customer phone number is missing.");
      return;
    }

    if (!whatsappInput.trim()) {
      alert("Please type a WhatsApp message.");
      return;
    }

    setSendingWhatsapp(true);

    const messageToSend = whatsappInput.trim();

    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message: messageToSend,
        mode: "text",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(JSON.stringify(result, null, 2));
      setSendingWhatsapp(false);
      return;
    }

    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        company_id: profile.company_id,
        lead_id: lead.id,
        sender_type: "user",
        sender_name: profile.full_name,
        message: messageToSend,
      })
      .select("*")
      .single();

    if (saveError) {
      alert("Message sent, but failed to save in CRM: " + saveError.message);
    }

    await addActivity("WhatsApp Sent", messageToSend, "whatsapp", "green");

    if (savedMessage) {
      setWhatsappMessages((prev) => [...prev, savedMessage]);
    }

    setWhatsappInput("");
    setSendingWhatsapp(false);
  }

  async function submitToFinance() {
    if (!lead) return;

    const { data: existingApplication, error: checkError } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("lead_id", lead.id)
      .eq("company_id", profile?.company_id)
      .maybeSingle();

    if (checkError) {
      alert("Error checking finance application: " + checkError.message);
      return;
    }

    if (existingApplication) {
      alert("This lead has already been submitted to finance.");
      return;
    }

    const { error: financeError } = await supabase
      .from("finance_applications")
      .insert({
        lead_id: lead.id,
        customer: lead.customer,
        vehicle: lead.vehicle,
        requested_amount: 0,
        deposit: 0,
        monthly_budget: 0,
        finance_status: "Submitted",
        bank: "Pending bank allocation",
        company_id: profile?.company_id,
        finance_notes: "Finance application submitted from lead detail page.",
      });

    if (financeError) {
      alert("Error submitting to finance: " + financeError.message);
      return;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({
        finance: "Submitted",
        status: "Submitted to Finance",
      })
      .eq("id", leadId)
      .eq("company_id", profile?.company_id);

    if (leadError) {
      alert("Finance submitted, but lead update failed: " + leadError.message);
      return;
    }

    await addActivity(
      "Submitted to Finance",
      "Lead was submitted to the finance department for review.",
      "Finance",
      "orange"
    );

    setLead((currentLead) =>
      currentLead
        ? {
            ...currentLead,
            finance: "Submitted",
            status: "Submitted to Finance",
          }
        : currentLead
    );

    setLeadStatus("Submitted to Finance");
    alert("Lead submitted to finance successfully.");

    fetchLead();
    fetchActivities();
    checkFinanceApplication();
  }

  async function createTask() {
    if (!lead || !profile?.company_id) return;

    if (!taskTitle.trim() || !taskDueDate) {
      alert("Please enter a task title and due date.");
      return;
    }

    const selectedUser =
      salesUsers.find((user) => user.id === Number(taskAssignedUserId)) ||
      salesUsers.find((user) => user.id === lead.assigned_user_id);

    const { error } = await supabase.from("tasks").insert({
      company_id: profile.company_id,
      lead_id: lead.id,
      assigned_user_id: selectedUser?.id || profile.id,
      assigned_user_name:
        selectedUser?.full_name || selectedUser?.email || profile.full_name,
      title: taskTitle,
      description: taskDescription,
      task_type: "Follow-up",
      status: "Open",
      priority: taskPriority,
      due_date: taskDueDate,
      created_by_id: profile.id,
      created_by_name: profile.full_name,
    });

    if (error) {
      alert("Error creating task: " + error.message);
      return;
    }

    await addActivity(
      "Task Created",
      `${taskTitle} • Due: ${new Date(taskDueDate).toLocaleString("en-ZA")}`,
      "task",
      "blue"
    );

    setShowTaskModal(false);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskPriority("Medium");
    setTaskAssignedUserId("");

    alert("Task created successfully.");
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

  async function fetchLead() {
    setLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("company_id", profile?.company_id);

    if (profile?.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      console.error("Lead not found or access denied:", error?.message);
      setLead(null);
      setLoading(false);
      return;
    }

    setLead(data);
    setLeadStatus(data.status || "New Lead");
    setAssignedUserId(data.assigned_user_id || "");
    setLoading(false);
  }

  async function reassignLead(newUserId: number) {
    if (!lead || !profile?.company_id) return;

    const selectedUser = salesUsers.find((user) => user.id === newUserId);

    if (!selectedUser) {
      alert("Selected user not found.");
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({
        assigned_user_id: selectedUser.id,
        assigned_user_name:
          selectedUser.full_name || selectedUser.email || "Unknown User",
      })
      .eq("id", lead.id)
      .eq("company_id", profile.company_id);

    if (error) {
      alert("Error reassigning lead: " + error.message);
      return;
    }

    await addActivity(
      "Lead Reassigned",
      `Lead assigned to ${
        selectedUser.full_name || selectedUser.email || "Unknown User"
      }`,
      "assignment",
      "blue"
    );

    setAssignedUserId(selectedUser.id);
    fetchLead();
  }

  async function fetchActivities() {
    const { data, error } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .eq("company_id", profile?.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading activities:", error.message);
    } else {
      setTimeline(data || []);
    }
  }

  async function addActivity(
    title: string,
    description: string,
    activityType: string,
    color: string
  ) {
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      title,
      description,
      activity_type: activityType,
      color,
      company_id: profile?.company_id,
    });

    if (error) {
      alert("Error saving activity: " + error.message);
      return;
    }

    fetchActivities();
  }

  async function checkFinanceApplication() {
    const { data, error } = await supabase
      .from("finance_applications")
      .select("id")
      .eq("lead_id", leadId)
      .eq("company_id", profile?.company_id)
      .maybeSingle();

    if (error) {
      console.error("Error checking finance application:", error.message);
      return;
    }

    setFinanceApplicationId(data ? data.id : null);
  }

  useEffect(() => {
    if (!leadId || !profile?.company_id) return;

    fetchLead();
    fetchActivities();
    checkFinanceApplication();
    fetchSalesUsers();
    fetchWhatsappMessages();
  }, [leadId, profile?.company_id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-6 shadow">Loading lead...</div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-10 shadow">
          <h1 className="text-2xl font-bold text-slate-800">Lead Not Found</h1>
          <p className="mt-3 text-slate-500">
            You do not have permission to view this lead, or it no longer exists.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  {lead.customer}
                </h1>
                <p className="mt-1 text-slate-500">
                  Interested in {lead.vehicle}
                </p>
              </div>

              <select
                value={leadStatus}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  setLeadStatus(newStatus);

                  const { error } = await supabase
                    .from("leads")
                    .update({ status: newStatus })
                    .eq("id", leadId)
                    .eq("company_id", profile?.company_id);

                  if (error) {
                    alert("Error updating lead status: " + error.message);
                    return;
                  }

                  await addActivity(
                    "Lead Status Updated",
                    `Status changed to ${newStatus}`,
                    "status",
                    "blue"
                  );
                }}
                className="rounded-full border border-blue-300 bg-blue-100 px-4 py-2 text-sm brand-accent-text"
              >
                <option>New Lead</option>
                <option>Attempted Contact</option>
                <option>Interested</option>
                <option>Test Drive Booked</option>
                <option>Finance Docs Pending</option>
                <option>Submitted to Finance</option>
                <option>Approved</option>
                <option>Declined</option>
                <option>Deal Closed</option>
              </select>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Phone Number</p>
                <button className="mt-1 text-lg font-medium text-slate-800 hover:text-blue-600">
                  {lead.phone || "No phone captured"}
                </button>
              </div>

              <div>
                <p className="text-sm text-slate-500">Assigned To</p>

                {profile?.role === "Admin" || profile?.role === "Manager" ? (
                  <select
                    value={assignedUserId}
                    onChange={(e) => {
                      const newUserId = Number(e.target.value);
                      setAssignedUserId(newUserId);
                      reassignLead(newUserId);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {salesUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-lg font-medium text-slate-800">
                    {lead.assigned_user_name || lead.salesperson || "Unassigned"}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-slate-500">Budget</p>
                <p className="mt-1 text-lg font-medium text-slate-800">
                  {lead.budget || "Not captured"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Finance Status</p>
                <span className="mt-1 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                  {lead.finance || "Not Submitted"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Vehicle Interest
                </h2>
                <p className="text-slate-500">Customer selected vehicle</p>
              </div>

              <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                In Stock
              </span>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div className="flex h-40 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                Vehicle Image
              </div>

              <div className="md:col-span-2">
                <h3 className="text-xl font-bold text-slate-800">
                  {lead.vehicle || "Vehicle not selected"}
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-slate-500">Price</p>
                    <p className="text-lg font-semibold text-slate-800">
                      R429,900
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Mileage</p>
                    <p className="text-lg font-semibold text-slate-800">
                      32,000 km
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">
                      Estimated Installment
                    </p>
                    <p className="text-lg font-semibold text-slate-800">
                      R7,899/month
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Stock Code</p>
                    <p className="text-lg font-semibold text-slate-800">
                      DF-POLO-221
                    </p>
                  </div>
                </div>

                <button className="mt-5 rounded-lg brand-primary-bg px-4 py-2 text-white">
                  View Stock Details
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold text-slate-800">
              Activity Timeline
            </h2>

            <div className="mt-6 space-y-5">
              {timeline.length === 0 && (
                <p className="text-slate-500">No activity recorded yet.</p>
              )}

              {timeline.map((item) => (
                <div
                  key={item.id}
                  className={`border-l-4 pl-4 ${
                    item.color === "blue"
                      ? "border-blue-500"
                      : item.color === "green"
                      ? "border-green-500"
                      : "border-orange-500"
                  }`}
                >
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-slate-500">{item.description}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {new Date(item.created_at).toLocaleString("en-ZA")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => {
                  setTaskAssignedUserId(lead.assigned_user_id || profile?.id || "");
                  setShowTaskModal(true);
                }}
                className="w-full rounded-lg px-4 py-3 text-white transition"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                Add Follow-Up Task
              </button>

              <button
                onClick={() => {
                  whatsappSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });

                  setTimeout(() => {
                    whatsappInputRef.current?.focus();
                  }, 500);
                }}
                className="w-full rounded-lg brand-primary-bg px-4 py-3 text-white"
              >
                Send WhatsApp
              </button>

              <button
                onClick={() => setShowCallModal(true)}
                className="w-full rounded-lg brand-accent-bg px-4 py-3 text-white"
              >
                Log Call Attempt
              </button>

              {financeApplicationId ? (
                <a
                  href={`/finance/${financeApplicationId}`}
                  className="block w-full rounded-lg brand-primary-bg px-4 py-3 text-center text-white"
                >
                  Open Finance Application
                </a>
              ) : (
                <button
                  onClick={submitToFinance}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-500"
                >
                  Submit to Finance
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Affordability Calculator
              </h2>
              <p className="text-sm text-slate-500">
                Estimate monthly vehicle repayments
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Vehicle Price
                </label>
                <input
                  type="number"
                  value={vehiclePrice}
                  onChange={(e) => setVehiclePrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Deposit
                </label>
                <input
                  type="number"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Interest Rate %
                </label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Term Months
                </label>
                <input
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>
            </div>

            <div className="mt-6 rounded-xl brand-primary-bg p-5 text-white">
              <p className="text-sm text-slate-300">
                Estimated Monthly Installment
              </p>

              <p className="mt-2 text-3xl font-bold">
                R
                {estimatedInstallment.toLocaleString("en-ZA", {
                  maximumFractionDigits: 0,
                })}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Finance amount: R{financeAmount.toLocaleString("en-ZA")}
              </p>
            </div>

            <button
              onClick={() => {
                addActivity(
                  "Affordability Calculated",
                  `Estimated installment: R${estimatedInstallment.toLocaleString(
                    "en-ZA",
                    { maximumFractionDigits: 0 }
                  )}/month`,
                  "calculator",
                  "orange"
                );
              }}
              className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 text-white hover:bg-orange-400"
            >
              Save Calculation to Timeline
            </button>
          </div>

          <div
            id="whatsapp"
            ref={whatsappSectionRef}
            className="rounded-xl bg-white p-6 shadow"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  WhatsApp Conversation
                </h2>
                <p className="text-sm text-slate-500">
                  Send real WhatsApp messages to this customer
                </p>
              </div>

              <a
                href={`https://wa.me/${normalizePhone(lead.phone)}`}
                target="_blank"
                className="rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200"
              >
                Open WhatsApp
              </a>
            </div>

            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-green-50 p-4">
              {whatsappMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  No WhatsApp messages logged yet.
                </p>
              ) : (
                whatsappMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_type === "customer"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow ${
                        msg.sender_type === "customer"
                          ? "bg-white text-slate-800"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p
                        className={`mt-1 text-right text-xs ${
                          msg.sender_type === "customer"
                            ? "text-slate-400"
                            : "text-green-100"
                        }`}
                      >
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleString("en-ZA")
                          : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <textarea
                ref={whatsappInputRef}
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                placeholder="Type WhatsApp message..."
                className="min-h-20 flex-1 rounded-xl border border-slate-300 p-3 text-sm"
              />

              <button
                onClick={sendWhatsappMessage}
                disabled={sendingWhatsapp}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {sendingWhatsapp ? "Sending..." : "Send"}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Note: free-text WhatsApp messages require the customer to have
              messaged the business number within the 24-hour window. Use Meta
              templates for first contact.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">
              Follow-Up Tasks
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-slate-100 p-4">
                <p className="font-medium text-slate-800">
                  Follow up tomorrow
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Customer wants updated quote
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 p-4">
                <p className="font-medium text-slate-800">
                  Await bank statements
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Requested via WhatsApp
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCallModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Call Outcome
            </h2>

            <div className="mt-5 space-y-3">
              {[
                "Answered",
                "No Answer",
                "Busy",
                "Voicemail",
                "Wrong Number",
                "Call Back Later",
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => setCallOutcome(option)}
                  className={`w-full rounded-lg border px-4 py-3 text-left ${
                    callOutcome === option
                      ? "border-blue-500 bg-blue-100"
                      : "border-slate-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Add notes..."
              className="mt-5 w-full rounded-lg border border-slate-300 p-3"
              rows={4}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowCallModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (!callOutcome) {
                    alert("Please select a call outcome.");
                    return;
                  }

                  await addActivity(
                    "Call Attempt Logged",
                    `Outcome: ${callOutcome}${
                      callNotes ? ` • ${callNotes}` : ""
                    }`,
                    "call",
                    "green"
                  );

                  setShowCallModal(false);
                  setCallOutcome("");
                  setCallNotes("");
                }}
                className="rounded-lg brand-accent-bg px-4 py-2 text-white"
              >
                Save Call Log
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Create Follow-Up Task
            </h2>

            <p className="mt-1 text-slate-500">
              Create a callback, reminder or next action for this lead.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Task Title
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Call customer about finance docs"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Additional task notes..."
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Due Date / Time
                </label>
                <input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
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
                  Assign To
                </label>
                <select
                  value={taskAssignedUserId}
                  onChange={(e) => setTaskAssignedUserId(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                >
                  {salesUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={createTask}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}