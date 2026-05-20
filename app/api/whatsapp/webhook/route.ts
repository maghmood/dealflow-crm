import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizePhone(phone: string | null) {
  if (!phone) return "";

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "27" + cleaned.slice(1);
  }

  return cleaned;
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
    { error: "Webhook verification failed" },
    { status: 403 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const fromPhone = normalizePhone(message.from);
    const customerName = contact?.profile?.name || "WhatsApp Customer";

    const messageText =
      message?.text?.body ||
      "[Unsupported WhatsApp message type]";

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, company_id, customer, phone, assigned_user_id, assigned_user_name")
      .or(`phone.eq.${fromPhone},phone.eq.0${fromPhone.slice(2)}`)
      .maybeSingle();

    if (leadError) {
      console.error("Error finding lead:", leadError.message);
      return NextResponse.json({ success: true });
    }

    if (!lead) {
      console.log("No matching lead found for WhatsApp phone:", fromPhone);
      return NextResponse.json({ success: true });
    }

    await supabaseAdmin.from("whatsapp_messages").insert({
      company_id: lead.company_id,
      lead_id: lead.id,
      sender_type: "customer",
      sender_name: customerName,
      message: messageText,
      created_at: new Date(Number(message.timestamp) * 1000).toISOString(),
    });

    await supabaseAdmin.from("whatsapp_conversations").upsert(
      {
        company_id: lead.company_id,
        lead_id: lead.id,
        customer_name: lead.customer,
        customer_phone: fromPhone,
        assigned_user_id: lead.assigned_user_id,
        assigned_user_name: lead.assigned_user_name,
        last_message: messageText,
        last_message_at: new Date(
          Number(message.timestamp) * 1000
        ).toISOString(),
        status: "Open",
      },
      {
        onConflict: "lead_id",
      }
    );

    await supabaseAdmin.from("lead_activities").insert({
      company_id: lead.company_id,
      lead_id: lead.id,
      title: "WhatsApp Message Received",
      description: messageText,
      activity_type: "whatsapp",
      color: "blue",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}