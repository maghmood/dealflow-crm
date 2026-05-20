import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      full_name,
      email,
      role,
      company_id,
    } = body;

    if (!full_name || !email || !role || !company_id) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const temporaryPassword =
      Math.random().toString(36).slice(-10) + "A1!";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Failed to create auth user.",
        },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        auth_user_id: authData.user.id,
        company_id,
        full_name,
        email,
        role,
        status: "Active",
      });

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      temporaryPassword,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}