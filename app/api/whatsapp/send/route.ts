import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SendRequestBody = {
  leadId?: number;
  message?: string;
  mode?: "text" | "template";
};

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return "";

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = `27${cleaned.slice(1)}`;
  }

  return cleaned;
}

export async function POST(req: Request) {
  try {
    const authorizationHeader = req.headers.get("authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const accessToken = authorizationHeader.slice("Bearer ".length).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid or expired authorization token." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, company_id, role, status, full_name, email")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile could not be found." },
        { status: 403 }
      );
    }

    if (profile.status !== "Active") {
      return NextResponse.json(
        { error: "Your user account is inactive." },
        { status: 403 }
      );
    }

    if (profile.role === "ReadOnly") {
      return NextResponse.json(
        { error: "ReadOnly users cannot send WhatsApp messages." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as SendRequestBody;

    const leadId = Number(body.leadId);
    const message = body.message?.trim() || "";
    const mode = body.mode || "text";

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: "A valid lead ID is required." },
        { status: 400 }
      );
    }

    if (mode === "text" && !message) {
      return NextResponse.json(
        { error: "Message text is required." },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(
        "id, company_id, customer, phone, assigned_user_id, assigned_user_name"
      )
      .eq("id", leadId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found or access denied." },
        { status: 404 }
      );
    }

    if (
      profile.role === "Sales" &&
      lead.assigned_user_id !== profile.id
    ) {
      return NextResponse.json(
        { error: "You do not have access to this lead." },
        { status: 403 }
      );
    }

    const recipient = normalizePhone(lead.phone);

    if (!recipient) {
      return NextResponse.json(
        { error: "The lead does not have a valid phone number." },
        { status: 400 }
      );
    }

    const whatsappPhoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const whatsappAccessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

    if (!whatsappPhoneNumberId || !whatsappAccessToken) {
      console.error(
        "WhatsApp environment variables are not configured."
      );

      return NextResponse.json(
        { error: "WhatsApp integration is not configured." },
        { status: 500 }
      );
    }

    const payload =
      mode === "template"
        ? {
            messaging_product: "whatsapp",
            to: recipient,
            type: "template",
            template: {
              name: "hello_world",
              language: {
                code: "en_US",
              },
            },
          }
        : {
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: {
              preview_url: false,
              body: message,
            },
          };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error(
        "WhatsApp send API error:",
        JSON.stringify(responseData)
      );

      return NextResponse.json(
        {
          error:
            responseData?.error?.message ||
            "WhatsApp rejected the message.",
          details: responseData?.error || responseData,
        },
        { status: response.status >= 400 ? response.status : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipient,
      leadId: lead.id,
      companyId: lead.company_id,
      senderProfileId: profile.id,
      senderName:
        profile.full_name || profile.email || "Unknown User",
      data: responseData,
    });
  } catch (error) {
    console.error("Unexpected WhatsApp send-route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error sending WhatsApp message." },
      { status: 500 }
    );
  }
}