"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import PageAccessGuard from "@/components/PageAccessGuard";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

type Conversation = {
  id: number;
  company_id: number;
  lead_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  external_contact_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
  unread_count: number;
  waiting_for_response: boolean;
  first_response_at: string | null;
  status: "Open" | "Closed" | "Archived";
  closed_at: string | null;
  is_unmatched: boolean;
  updated_at: string;
};

type WhatsAppMessage = {
  id: number;
  company_id: number;
  lead_id: number | null;
  conversation_id: number | null;
  sender_type: "customer" | "user";
  sender_name: string | null;
  direction: "Inbound" | "Outbound";
  message: string;
  message_type: string;
  meta_message_id: string | null;
  delivery_status:
    | "Pending"
    | "Sent"
    | "Delivered"
    | "Read"
    | "Failed"
    | "Received"
    | null;
  error_message: string | null;
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
  created_at: string;
};

const STATUS_FILTERS = ["Open", "Closed", "All"] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();
  const differenceMinutes = Math.floor(
    (now.getTime() - date.getTime()) / 60000
  );

  if (differenceMinutes < 1) return "Just now";
  if (differenceMinutes < 60) return `${differenceMinutes} min ago`;

  const differenceHours = Math.floor(differenceMinutes / 60);

  if (differenceHours < 24) {
    return `${differenceHours} hr${differenceHours === 1 ? "" : "s"} ago`;
  }

  const differenceDays = Math.floor(differenceHours / 24);

  if (differenceDays < 7) {
    return `${differenceDays} day${differenceDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

function deliveryStatusLabel(status: WhatsAppMessage["delivery_status"]) {
  if (!status) return "";

  if (status === "Read") return "✓✓ Read";
  if (status === "Delivered") return "✓✓ Delivered";
  if (status === "Sent") return "✓ Sent";
  if (status === "Failed") return "Failed";
  if (status === "Received") return "Received";

  return status;
}

export default function WhatsAppInboxPage() {
  const { profile } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("Open");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showWaitingOnly, setShowWaitingOnly] = useState(false);

  const [replyText, setReplyText] = useState("");

  const selectedConversation =
    conversations.find(
      (conversation) => conversation.id === selectedConversationId
    ) || null;

  async function fetchConversations(
    preferredConversationId?: number | null
  ) {
    if (!profile?.company_id) return;

    setLoadingConversations(true);

    let query = supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("last_message_at", { ascending: false });

    // Sales staff only see their own assigned conversations in the UI.
    if (profile.role === "Sales") {
      query = query.eq("assigned_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Error loading WhatsApp conversations:",
        error.message
      );
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const loadedConversations = Array.isArray(data)
      ? (data as Conversation[])
      : [];

    setConversations(loadedConversations);

    const targetConversationId =
      preferredConversationId ??
      selectedConversationId ??
      loadedConversations[0]?.id ??
      null;

    if (
      targetConversationId &&
      loadedConversations.some(
        (conversation) => conversation.id === targetConversationId
      )
    ) {
      setSelectedConversationId(targetConversationId);
    } else {
      setSelectedConversationId(null);
      setMessages([]);
    }

    setLoadingConversations(false);
  }

  async function fetchMessages(conversationId: number) {
    if (!profile?.company_id) return;

    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Error loading WhatsApp messages:",
        error.message
      );
      setMessages([]);
    } else {
      setMessages(
        Array.isArray(data) ? (data as WhatsAppMessage[]) : []
      );
    }

    setLoadingMessages(false);
  }

  async function markConversationRead(conversation: Conversation) {
    if (!profile?.company_id || profile.role === "ReadOnly") return;

    if (conversation.unread_count === 0) return;

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        unread_count: 0,
        last_read_at: readAt,
      })
      .eq("id", conversation.id)
      .eq("company_id", profile.company_id);

    if (error) {
      console.error(
        "Error marking conversation as read:",
        error.message
      );
      return;
    }

    setConversations((current) =>
      current.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              unread_count: 0,
              last_read_at: readAt,
            }
          : item
      )
    );
  }

  async function openConversation(conversation: Conversation) {
    setSelectedConversationId(conversation.id);
    setReplyText("");

    await Promise.all([
      fetchMessages(conversation.id),
      markConversationRead(conversation),
    ]);
  }

  async function sendReply() {
    if (
      !profile?.company_id ||
      !selectedConversation ||
      !selectedConversation.lead_id
    ) {
      alert("This conversation is not linked to a lead.");
      return;
    }

    const messageToSend = replyText.trim();

    if (!messageToSend) {
      alert("Please type a WhatsApp message.");
      return;
    }

    setSendingMessage(true);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        alert("Your login session has expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          leadId: selectedConversation.lead_id,
          message: messageToSend,
          mode: "text",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(
          result?.error ||
            JSON.stringify(result?.details || result, null, 2)
        );
        return;
      }

      const messageDate = new Date().toISOString();
      const metaMessageId =
        result?.data?.messages?.[0]?.id || null;
      const verifiedRecipient =
        result?.recipient ||
        selectedConversation.customer_phone ||
        "";

      const firstResponseAt =
        !selectedConversation.first_response_at &&
        selectedConversation.last_inbound_at
          ? messageDate
          : selectedConversation.first_response_at;

      const { data: savedMessage, error: messageError } =
        await supabase
          .from("whatsapp_messages")
          .insert({
            company_id: profile.company_id,
            lead_id: selectedConversation.lead_id,
            conversation_id: selectedConversation.id,
            sender_type: "user",
            sender_name:
              profile.full_name ||
              profile.email ||
              "Unknown User",
            direction: "Outbound",
            message: messageToSend,
            message_type: "text",
            meta_message_id: metaMessageId,
            delivery_status: "Sent",
            created_at: messageDate,
          })
          .select("*")
          .single();

      if (messageError || !savedMessage) {
        alert(
          "Message was sent, but could not be saved in the CRM: " +
            (messageError?.message || "Unknown error")
        );
        return;
      }

      const { error: conversationError } = await supabase
        .from("whatsapp_conversations")
        .update({
          customer_phone: verifiedRecipient,
          last_message: messageToSend,
          last_message_at: messageDate,
          last_outbound_at: messageDate,
          unread_count: 0,
          waiting_for_response: false,
          first_response_at: firstResponseAt,
          last_read_at: messageDate,
          status: "Open",
          closed_at: null,
        })
        .eq("id", selectedConversation.id)
        .eq("company_id", profile.company_id);

      if (conversationError) {
        console.error(
          "Message saved, but conversation update failed:",
          conversationError.message
        );
      }

      const { error: activityError } = await supabase
        .from("lead_activities")
        .insert({
          company_id: profile.company_id,
          lead_id: selectedConversation.lead_id,
          title: "WhatsApp Sent",
          description: messageToSend,
          activity_type: "whatsapp",
          color: "green",
        });

      if (activityError) {
        console.error(
          "Message saved, but lead activity failed:",
          activityError.message
        );
      }

      setMessages((current) => [
        ...current,
        savedMessage as WhatsAppMessage,
      ]);

      setReplyText("");

      await fetchConversations(selectedConversation.id);
    } catch (error) {
      console.error("Unexpected WhatsApp reply error:", error);
      alert("Unexpected error sending WhatsApp reply.");
    } finally {
      setSendingMessage(false);
    }
  }

  useEffect(() => {
    if (!profile?.company_id) return;

    fetchConversations();
  }, [profile?.company_id, profile?.role, profile?.id]);

  useEffect(() => {
    if (!selectedConversationId) return;

    fetchMessages(selectedConversationId);
  }, [selectedConversationId, profile?.company_id]);

  const filteredConversations = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (
        statusFilter !== "All" &&
        conversation.status !== statusFilter
      ) {
        return false;
      }

      if (showUnreadOnly && conversation.unread_count <= 0) {
        return false;
      }

      if (
        showWaitingOnly &&
        !conversation.waiting_for_response
      ) {
        return false;
      }

      if (!search) return true;

      const searchableText = [
        conversation.customer_name,
        conversation.external_contact_name,
        conversation.customer_phone,
        conversation.assigned_user_name,
        conversation.last_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [
    conversations,
    searchText,
    statusFilter,
    showUnreadOnly,
    showWaitingOnly,
  ]);

  const unreadConversationCount = conversations.filter(
    (conversation) => conversation.unread_count > 0
  ).length;

  const waitingConversationCount = conversations.filter(
    (conversation) => conversation.waiting_for_response
  ).length;

  return (
    <DashboardLayout>
      <PageAccessGuard module="whatsapp">
        <ReadOnlyNotice />

        <div className="space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                WhatsApp Inbox
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage customer conversations and outstanding replies.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
                {unreadConversationCount} unread
              </span>

              <span className="rounded-full bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700">
                {waitingConversationCount} waiting
              </span>

              <button
                type="button"
                onClick={() =>
                  fetchConversations(selectedConversationId)
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid min-h-[680px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 xl:grid-cols-[380px_1fr]">
            <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
              <div className="space-y-3 border-b border-slate-200 p-4">
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) =>
                    setSearchText(event.target.value)
                  }
                  placeholder="Search customers, phone or messages..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />

                <div className="grid grid-cols-3 gap-2">
                  {STATUS_FILTERS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        statusFilter === status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowUnreadOnly((current) => !current)
                    }
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      showUnreadOnly
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Unread only
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowWaitingOnly((current) => !current)
                    }
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      showWaitingOnly
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Waiting only
                  </button>
                </div>
              </div>

              <div className="max-h-[560px] overflow-y-auto">
                {loadingConversations ? (
                  <div className="p-6 text-sm text-slate-500">
                    Loading conversations...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-3xl">💬</div>

                    <p className="mt-3 font-semibold text-slate-700">
                      No conversations found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Adjust the filters or send a message from a lead.
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const isSelected =
                      conversation.id === selectedConversationId;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() =>
                          openConversation(conversation)
                        }
                        className={`block w-full border-b border-slate-100 p-4 text-left transition ${
                          isSelected
                            ? "bg-blue-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">
                              {conversation.customer_name ||
                                conversation.external_contact_name ||
                                "WhatsApp Customer"}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-400">
                              {conversation.customer_phone || "No phone"}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="text-xs text-slate-400">
                              {formatRelativeTime(
                                conversation.last_message_at
                              )}
                            </span>

                            {conversation.unread_count > 0 && (
                              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                                {conversation.unread_count}
                              </span>
                            )}
                          </div>
                        </div>

                        <p
                          className={`mt-3 truncate text-sm ${
                            conversation.unread_count > 0
                              ? "font-semibold text-slate-800"
                              : "text-slate-500"
                          }`}
                        >
                          {conversation.last_message ||
                            "No messages yet"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {conversation.waiting_for_response && (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                              Waiting for response
                            </span>
                          )}

                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {conversation.assigned_user_name ||
                              "Unassigned"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              {!selectedConversation ? (
                <div className="flex flex-1 items-center justify-center p-10 text-center">
                  <div>
                    <div className="text-5xl">💬</div>

                    <h2 className="mt-4 text-xl font-bold text-slate-800">
                      Select a conversation
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Choose a customer conversation from the inbox.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedConversation.customer_name ||
                            selectedConversation.external_contact_name ||
                            "WhatsApp Customer"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {selectedConversation.customer_phone ||
                            "No phone number"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Assigned to{" "}
                          {selectedConversation.assigned_user_name ||
                            "Unassigned"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedConversation.waiting_for_response && (
                          <span className="rounded-full bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700">
                            Customer waiting
                          </span>
                        )}

                        {selectedConversation.lead_id && (
                          <Link
                            href={`/leads/${selectedConversation.lead_id}`}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                          >
                            Open Lead
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
                    {loadingMessages ? (
                      <p className="text-sm text-slate-500">
                        Loading messages...
                      </p>
                    ) : messages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <p className="font-semibold text-slate-700">
                          No messages found
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const isOutbound =
                            message.direction === "Outbound";

                          return (
                            <div
                              key={message.id}
                              className={`flex ${
                                isOutbound
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
                                  isOutbound
                                    ? "bg-green-600 text-white"
                                    : "bg-white text-slate-800 ring-1 ring-slate-200"
                                }`}
                              >
                                <p className="text-sm leading-6">
                                  {message.message}
                                </p>

                                {message.media_filename && (
                                  <p className="mt-2 text-xs opacity-80">
                                    📎 {message.media_filename}
                                  </p>
                                )}

                                {message.error_message && (
                                  <p className="mt-2 text-xs font-semibold text-red-200">
                                    {message.error_message}
                                  </p>
                                )}

                                <div
                                  className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] ${
                                    isOutbound
                                      ? "text-green-100"
                                      : "text-slate-400"
                                  }`}
                                >
                                  <span>
                                    {message.sender_name ||
                                      (isOutbound
                                        ? "CRM User"
                                        : "Customer")}
                                  </span>

                                  <span>•</span>

                                  <span>
                                    {formatDateTime(
                                      message.created_at
                                    )}
                                  </span>

                                  {isOutbound &&
                                    message.delivery_status && (
                                      <>
                                        <span>•</span>

                                        <span
                                          className={
                                            message.delivery_status ===
                                            "Failed"
                                              ? "font-semibold text-red-200"
                                              : ""
                                          }
                                        >
                                          {deliveryStatusLabel(
                                            message.delivery_status
                                          )}
                                        </span>
                                      </>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 bg-white p-4">
                    {selectedConversation.lead_id ? (
                      <WriteAccessGuard
                        fallback={
                          <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                            ReadOnly users cannot send WhatsApp replies.
                          </div>
                        }
                      >
                        <div className="flex items-end gap-3">
                          <textarea
                            value={replyText}
                            onChange={(event) =>
                              setReplyText(event.target.value)
                            }
                            placeholder="Type a WhatsApp reply..."
                            rows={3}
                            className="min-h-20 flex-1 resize-none rounded-xl border border-slate-300 p-3 text-sm"
                          />

                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={
                              sendingMessage || !replyText.trim()
                            }
                            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sendingMessage ? "Sending..." : "Send"}
                          </button>
                        </div>
                      </WriteAccessGuard>
                    ) : (
                      <div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-700">
                        This WhatsApp conversation is not linked to a lead.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </PageAccessGuard>
    </DashboardLayout>
  );
}