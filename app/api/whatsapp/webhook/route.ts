import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
  image?: {
    id?: string;
    caption?: string;
    mime_type?: string;
  };
  document?: {
    id?: string;
    caption?: string;
    filename?: string;
    mime_type?: string;
  };
  audio?: {
    id?: string;
    mime_type?: string;
    voice?: boolean;
  };
  video?: {
    id?: string;
    caption?: string;
    mime_type?: string;
  };
  interactive?: {
    type?: string;
    button_reply?: {
      id?: string;
      title?: string;
    };
    list_reply?: {
      id?: string;
      title?: string;
      description?: string;
    };
  };
  button?: {
    text?: string;
    payload?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  context?: {
    id?: string;
  };
};

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: {
      details?: string;
    };
  }>;
};

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return "";

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = `27${cleaned.slice(1)}`;
  }

  return cleaned;
}

function mapDeliveryStatus(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Read";
    case "failed":
      return "Failed";
    default:
      return null;
  }
}

function getStatusErrorMessage(status: WhatsAppStatus) {
  const firstError = status.errors?.[0];

  if (!firstError) return null;

  return (
    firstError.error_data?.details ||
    firstError.message ||
    firstError.title ||
    (firstError.code ? `WhatsApp error ${firstError.code}` : null)
  );
}

function getMessageDetails(message: WhatsAppMessage) {
  const type = message.type || "unknown";

  if (type === "text") {
    return {
      text: message.text?.body || "",
      mediaId: null,
      mediaMimeType: null,
      mediaFilename: null,
      mediaCaption: null,
    };
  }

  if (type === "image") {
    const caption = message.image?.caption || null;

    return {
      text: caption || "[Image received]",
      mediaId: message.image?.id || null,
      mediaMimeType: message.image?.mime_type || null,
      mediaFilename: null,
      mediaCaption: caption,
    };
  }

  if (type === "document") {
    const filename = message.document?.filename || "Document";
    const caption = message.document?.caption || null;

    return {
      text: caption
        ? `[Document received: ${filename}] ${caption}`
        : `[Document received: ${filename}]`,
      mediaId: message.document?.id || null,
      mediaMimeType: message.document?.mime_type || null,
      mediaFilename: filename,
      mediaCaption: caption,
    };
  }

  if (type === "audio") {
    return {
      text: message.audio?.voice
        ? "[Voice note received]"
        : "[Audio received]",
      mediaId: message.audio?.id || null,
      mediaMimeType: message.audio?.mime_type || null,
      mediaFilename: null,
      mediaCaption: null,
    };
  }

  if (type === "video") {
    const caption = message.video?.caption || null;

    return {
      text: caption || "[Video received]",
      mediaId: message.video?.id || null,
      mediaMimeType: message.video?.mime_type || null,
      mediaFilename: null,
      mediaCaption: caption,
    };
  }

  if (type === "interactive") {
    const reply =
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      message.interactive?.list_reply?.description ||
      "[Interactive reply received]";

    return {
      text: reply,
      mediaId: null,
      mediaMimeType: null,
      mediaFilename: null,
      mediaCaption: null,
    };
  }

  if (type === "button") {
    return {
      text: message.button?.text || "[Button reply received]",
      mediaId: null,
      mediaMimeType: null,
      mediaFilename: null,
      mediaCaption: null,
    };
  }

  if (type === "location") {
    const locationParts = [
      message.location?.name,
      message.location?.address,
      message.location?.latitude !== undefined &&
      message.location?.longitude !== undefined
        ? `${message.location.latitude}, ${message.location.longitude}`
        : null,
    ].filter(Boolean);

    return {
      text:
        locationParts.length > 0
          ? `[Location received] ${locationParts.join(" • ")}`
          : "[Location received]",
      mediaId: null,
      mediaMimeType: null,
      mediaFilename: null,
      mediaCaption: null,
    };
  }

  return {
    text: `[Unsupported WhatsApp message type: ${type}]`,
    mediaId: null,
    mediaMimeType: null,
    mediaFilename: null,
    mediaCaption: null,
  };
}

async function processStatusEvents(statuses: WhatsAppStatus[]) {
  const results: Array<{
    metaMessageId: string | null;
    status: string | null;
    updated: boolean;
    reason?: string;
  }> = [];

  for (const statusEvent of statuses) {
    const metaMessageId = statusEvent.id || null;
    const mappedStatus = mapDeliveryStatus(statusEvent.status);

    if (!metaMessageId || !mappedStatus) {
      results.push({
        metaMessageId,
        status: mappedStatus,
        updated: false,
        reason: "Missing message ID or unsupported status",
      });

      continue;
    }

    const errorMessage =
      mappedStatus === "Failed"
        ? getStatusErrorMessage(statusEvent)
        : null;

    const { data: existingMessage, error: lookupError } =
      await supabaseAdmin
        .from("whatsapp_messages")
        .select("id, delivery_status")
        .eq("meta_message_id", metaMessageId)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "Error finding WhatsApp message for status update:",
        lookupError.message
      );

      results.push({
        metaMessageId,
        status: mappedStatus,
        updated: false,
        reason: lookupError.message,
      });

      continue;
    }

    if (!existingMessage) {
      console.log(
        "No CRM WhatsApp message found for Meta status:",
        metaMessageId,
        mappedStatus
      );

      results.push({
        metaMessageId,
        status: mappedStatus,
        updated: false,
        reason: "Message not found",
      });

      continue;
    }

    const statusRank: Record<string, number> = {
      Pending: 0,
      Sent: 1,
      Delivered: 2,
      Read: 3,
      Failed: 4,
      Received: 4,
    };

    const existingRank =
      statusRank[existingMessage.delivery_status || "Pending"] ?? 0;

    const incomingRank = statusRank[mappedStatus] ?? 0;

    // Do not downgrade Read back to Delivered or Sent.
    if (
      mappedStatus !== "Failed" &&
      incomingRank < existingRank
    ) {
      results.push({
        metaMessageId,
        status: mappedStatus,
        updated: false,
        reason: "Older status ignored",
      });

      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        delivery_status: mappedStatus,
        error_message: errorMessage,
      })
      .eq("id", existingMessage.id);

    if (updateError) {
      console.error(
        "Error updating WhatsApp message delivery status:",
        updateError.message
      );

      results.push({
        metaMessageId,
        status: mappedStatus,
        updated: false,
        reason: updateError.message,
      });

      continue;
    }

    console.log(
      "WHATSAPP_STATUS_UPDATED",
      JSON.stringify({
        metaMessageId,
        status: mappedStatus,
      })
    );

    results.push({
      metaMessageId,
      status: mappedStatus,
      updated: true,
    });
  }

  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge || "", {
      status: 200,
    });
  }

  return NextResponse.json(
    {
      error: "Webhook verification failed",
    },
    {
      status: 403,
    }
  );
}

export async function POST(req: Request) {
  console.log(
    "WHATSAPP_WEBHOOK_POST_RECEIVED",
    new Date().toISOString()
  );

  try {
    const body = await req.json();

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    const message: WhatsAppMessage | undefined =
      value?.messages?.[0];

    const statuses: WhatsAppStatus[] = Array.isArray(value?.statuses)
      ? value.statuses
      : [];

    const contact = value?.contacts?.[0];

    console.log(
      "WHATSAPP_WEBHOOK_EVENT_SUMMARY",
      JSON.stringify({
        object: body?.object || null,
        entryCount: Array.isArray(body?.entry)
          ? body.entry.length
          : 0,
        field:
          body?.entry?.[0]?.changes?.[0]?.field || null,
        hasMessages: Boolean(value?.messages?.length),
        hasStatuses: statuses.length > 0,
        statusCount: statuses.length,
      })
    );

    if (statuses.length > 0) {
      const statusResults = await processStatusEvents(statuses);

      // A payload may theoretically contain other data too, so only
      // return now when there is no inbound message to process.
      if (!message) {
        return NextResponse.json({
          success: true,
          event: "WhatsApp status update",
          results: statusResults,
        });
      }
    }

    if (!message) {
      console.log("WHATSAPP_WEBHOOK_NO_INBOUND_MESSAGE");

      return NextResponse.json({
        success: true,
        event: "No inbound message",
      });
    }

    const metaMessageId = message.id || null;

    if (metaMessageId) {
      const { data: existingMessage, error: duplicateCheckError } =
        await supabaseAdmin
          .from("whatsapp_messages")
          .select("id")
          .eq("meta_message_id", metaMessageId)
          .maybeSingle();

      if (duplicateCheckError) {
        console.error(
          "Error checking duplicate WhatsApp message:",
          duplicateCheckError.message
        );
      }

      if (existingMessage) {
        return NextResponse.json({
          success: true,
          duplicate: true,
        });
      }
    }

    const fromPhone = normalizePhone(message.from);

    if (!fromPhone) {
      console.error(
        "Inbound WhatsApp message has no valid sender number."
      );

      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const customerName =
      contact?.profile?.name || "WhatsApp Customer";

    const messageDate = message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    const messageDetails = getMessageDetails(message);

    const localPhone =
      fromPhone.startsWith("27") && fromPhone.length > 2
        ? `0${fromPhone.slice(2)}`
        : fromPhone;

    const { data: matchingLeads, error: leadError } =
      await supabaseAdmin
        .from("leads")
        .select(
          "id, company_id, customer, phone, assigned_user_id, assigned_user_name"
        )
        .or(
          [
            `phone.eq.${fromPhone}`,
            `phone.eq.+${fromPhone}`,
            `phone.eq.${localPhone}`,
          ].join(",")
        )
        .order("id", { ascending: false })
        .limit(2);

    if (leadError) {
      console.error(
        "Error finding lead for inbound WhatsApp message:",
        leadError.message
      );

      return NextResponse.json({
        success: true,
        stored: false,
      });
    }

    if (!matchingLeads || matchingLeads.length === 0) {
      console.log(
        "No matching lead found for WhatsApp phone:",
        fromPhone
      );

      return NextResponse.json({
        success: true,
        matched: false,
      });
    }

    if (matchingLeads.length > 1) {
      console.error(
        "Multiple leads match inbound WhatsApp phone:",
        fromPhone,
        matchingLeads.map((item) => item.id)
      );

      return NextResponse.json({
        success: true,
        matched: false,
        reason: "Multiple lead matches",
      });
    }

    const lead = matchingLeads[0];

    const { data: existingConversation, error: conversationCheckError } =
      await supabaseAdmin
        .from("whatsapp_conversations")
        .select("id, unread_count, first_response_at")
        .eq("company_id", lead.company_id)
        .eq("lead_id", lead.id)
        .maybeSingle();

    if (conversationCheckError) {
      console.error(
        "Error checking WhatsApp conversation:",
        conversationCheckError.message
      );

      return NextResponse.json({
        success: true,
        stored: false,
      });
    }

    let conversationId: number;
    let existingUnreadCount = 0;

    if (existingConversation) {
      conversationId = existingConversation.id;
      existingUnreadCount =
        Number(existingConversation.unread_count) || 0;

      const { error: conversationUpdateError } = await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
          customer_name: lead.customer,
          customer_phone: fromPhone,
          external_contact_name: customerName,
          assigned_user_id: lead.assigned_user_id,
          assigned_user_name: lead.assigned_user_name,
          last_message: messageDetails.text,
          last_message_at: messageDate,
          last_inbound_at: messageDate,
          unread_count: existingUnreadCount + 1,
          waiting_for_response: true,
          status: "Open",
          closed_at: null,
          is_unmatched: false,
        })
        .eq("id", conversationId)
        .eq("company_id", lead.company_id);

      if (conversationUpdateError) {
        console.error(
          "Error updating WhatsApp conversation:",
          conversationUpdateError.message
        );

        return NextResponse.json({
          success: true,
          stored: false,
        });
      }
    } else {
      const { data: createdConversation, error: conversationCreateError } =
        await supabaseAdmin
          .from("whatsapp_conversations")
          .insert({
            company_id: lead.company_id,
            lead_id: lead.id,
            customer_name: lead.customer,
            customer_phone: fromPhone,
            external_contact_name: customerName,
            assigned_user_id: lead.assigned_user_id,
            assigned_user_name: lead.assigned_user_name,
            last_message: messageDetails.text,
            last_message_at: messageDate,
            last_inbound_at: messageDate,
            unread_count: 1,
            waiting_for_response: true,
            status: "Open",
            is_unmatched: false,
          })
          .select("id")
          .single();

      if (conversationCreateError || !createdConversation) {
        console.error(
          "Error creating WhatsApp conversation:",
          conversationCreateError?.message ||
            "Conversation was not returned"
        );

        return NextResponse.json({
          success: true,
          stored: false,
        });
      }

      conversationId = createdConversation.id;
    }

    const { error: messageInsertError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        company_id: lead.company_id,
        lead_id: lead.id,
        conversation_id: conversationId,
        sender_type: "customer",
        sender_name: customerName,
        direction: "Inbound",
        message: messageDetails.text,
        message_type: message.type || "unknown",
        meta_message_id: metaMessageId,
        media_id: messageDetails.mediaId,
        media_mime_type: messageDetails.mediaMimeType,
        media_filename: messageDetails.mediaFilename,
        media_caption: messageDetails.mediaCaption,
        reply_to_meta_message_id: message.context?.id || null,
        delivery_status: "Received",
        created_at: messageDate,
      });

    if (messageInsertError) {
      console.error(
        "Error saving inbound WhatsApp message:",
        messageInsertError.message
      );

      return NextResponse.json({
        success: true,
        stored: false,
      });
    }

    const { error: activityError } = await supabaseAdmin
      .from("lead_activities")
      .insert({
        company_id: lead.company_id,
        lead_id: lead.id,
        title: "WhatsApp Message Received",
        description: messageDetails.text,
        activity_type: "whatsapp",
        color: "blue",
      });

    if (activityError) {
      console.error(
        "WhatsApp message saved, but lead activity failed:",
        activityError.message
      );
    }

    return NextResponse.json({
      success: true,
      matched: true,
      conversationId,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    return NextResponse.json(
      {
        error: "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}