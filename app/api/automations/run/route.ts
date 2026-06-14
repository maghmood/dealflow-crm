import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomationRequestBody = {
  companyId?: number;
  staleDays?: number;
  whatsappSlaMinutes?: number;
};

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

async function runAutomations({
  companyId,
  staleDays,
  whatsappSlaMinutes,
  runSource,
}: {
  companyId: number;
  staleDays: number;
  whatsappSlaMinutes: number;
  runSource: "Manual" | "Vercel Cron" | "API";
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "run_company_automations",
    {
      p_company_id: companyId,
      p_stale_days: staleDays,
      p_whatsapp_sla_minutes:
        whatsappSlaMinutes,
      p_run_source: runSource,
    }
  );

  if (error) {
    console.error(
      "AUTOMATION_RUN_RPC_ERROR",
      error
    );

    return {
      success: false,
      status: 500,
      error: error.message,
      data: null,
    };
  }

  const result = Array.isArray(data)
    ? data[0]
    : data;

  console.log(
    "AUTOMATION_RUN_COMPLETED",
    JSON.stringify(result)
  );

  return {
    success: true,
    status: 200,
    error: null,
    data: result,
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is not configured."
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Automation secret is not configured.",
      },
      { status: 500 }
    );
  }

  const suppliedToken = getBearerToken(request);

  if (suppliedToken !== cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  const companyId = Number(
    process.env.AUTOMATION_COMPANY_ID || "1"
  );

  const staleDays = Number(
    process.env.AUTOMATION_STALE_DAYS || "7"
  );

  const whatsappSlaMinutes = Number(
    process.env.AUTOMATION_WHATSAPP_SLA_MINUTES ||
      "30"
  );

  if (
    !Number.isInteger(companyId) ||
    companyId <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid AUTOMATION_COMPANY_ID.",
      },
      { status: 500 }
    );
  }

  const result = await runAutomations({
    companyId,
    staleDays,
    whatsappSlaMinutes,
    runSource: "Vercel Cron",
  });

  return NextResponse.json(
    {
      success: result.success,
      source: "Vercel Cron",
      result: result.data,
      error: result.error,
    },
    { status: result.status }
  );
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing authorization token.",
      },
      { status: 401 }
    );
  }

  const {
    data: userData,
    error: userError,
  } = await supabaseAdmin.auth.getUser(
    accessToken
  );

  if (
    userError ||
    !userData.user
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or expired login.",
      },
      { status: 401 }
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "id, company_id, role, status"
    )
    .eq(
      "auth_user_id",
      userData.user.id
    )
    .eq("status", "Active")
    .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Active user profile not found.",
      },
      { status: 403 }
    );
  }

  if (
    profile.role !== "Admin" &&
    profile.role !== "Manager"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Only Admin and Manager users may run automations.",
      },
      { status: 403 }
    );
  }

  let body: AutomationRequestBody = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const companyId = Number(
    body.companyId ||
      profile.company_id
  );

  if (
    companyId !==
    Number(profile.company_id)
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Company access denied.",
      },
      { status: 403 }
    );
  }

  const staleDays = Number(
    body.staleDays || 7
  );

  const whatsappSlaMinutes = Number(
    body.whatsappSlaMinutes || 30
  );

  if (
    !Number.isInteger(staleDays) ||
    staleDays < 1
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Stale days must be at least 1.",
      },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(
      whatsappSlaMinutes
    ) ||
    whatsappSlaMinutes < 1
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "WhatsApp SLA minutes must be at least 1.",
      },
      { status: 400 }
    );
  }

  const result = await runAutomations({
    companyId,
    staleDays,
    whatsappSlaMinutes,
    runSource: "Manual",
  });

  return NextResponse.json(
    {
      success: result.success,
      source: "Manual",
      result: result.data,
      error: result.error,
    },
    { status: result.status }
  );
}