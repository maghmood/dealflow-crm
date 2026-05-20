import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { to, message, mode = "text" } = body;

    if (!to) {
      return NextResponse.json({ error: "Missing recipient number" }, { status: 400 });
    }

    const payload =
      mode === "template"
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: "hello_world",
              language: { code: "en_US" },
            },
          }
        : {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
          };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}