import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomationRequestBody = {
  companyId?: number;
};

type RunSource =
  | "Manual"
  | "Vercel Cron"
  | "API";

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

async function runAutomations({
  companyId,
  runSource,
}: {
  companyId: number;
  runSource: RunSource;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "run_company_automations_from_settings",
    {
      p_company_id: companyId,
      p_run_source: runSource,
    }
  );

  if (error) {
    console.error(
      "AUTOMATION_RUN_RPC_ERROR",
      JSON.stringify({
        companyId,
        runSource,
        error: error.message,
      })
    );

    return {
      success: false,
      companyId,
      error: error.message,
      data: null,
    };
  }

  const result = Array.isArray(data)
    ? data[0]
    : data;

  console.log(
    "AUTOMATION_RUN_COMPLETED",
    JSON.stringify({
      companyId,
      runSource,
      result,
    })
  );

  return {
    success: true,
    companyId,
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

  /*
   * Run every company that has automation settings.
   * This replaces the previous single-company
   * AUTOMATION_COMPANY_ID behaviour.
   */
  const {
    data: settingsRows,
    error: settingsError,
  } = await supabaseAdmin
    .from("company_automation_settings")
    .select("company_id")
    .order("company_id", {
      ascending: true,
    });

  if (settingsError) {
    console.error(
      "AUTOMATION_COMPANY_LOOKUP_ERROR",
      settingsError
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Could not load companies configured for automation.",
      },
      { status: 500 }
    );
  }

  const companyIds = Array.from(
    new Set(
      (settingsRows || [])
        .map((row) => Number(row.company_id))
        .filter(
          (companyId) =>
            Number.isInteger(companyId) &&
            companyId > 0
        )
    )
  );

  if (companyIds.length === 0) {
    return NextResponse.json({
      success: true,
      source: "Vercel Cron",
      companyCount: 0,
      successfulCompanies: 0,
      failedCompanies: 0,
      results: [],
    });
  }

  const results = [];

  /*
   * Process sequentially so one company does not
   * overload the database or prevent others from running.
   */
  for (const companyId of companyIds) {
    results.push(
      await runAutomations({
        companyId,
        runSource: "Vercel Cron",
      })
    );
  }

  const successfulCompanies = results.filter(
    (result) => result.success
  ).length;

  const failedCompanies =
    results.length - successfulCompanies;

  return NextResponse.json(
    {
      success: failedCompanies === 0,
      source: "Vercel Cron",
      companyCount: results.length,
      successfulCompanies,
      failedCompanies,
      results,
    },
    {
      status:
        failedCompanies === results.length
          ? 500
          : 200,
    }
  );
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing authorization token.",
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
        error:
          "Invalid or expired login.",
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

  const result = await runAutomations({
    companyId,
    runSource: "Manual",
  });

  return NextResponse.json(
    {
      success: result.success,
      source: "Manual",
      result: result.data,
      error: result.error,
    },
    {
      status: result.success
        ? 200
        : 500,
    }
  );
}
