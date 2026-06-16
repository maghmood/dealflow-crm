import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extractFinanceDocumentPath(fileUrl: string | null) {
  if (!fileUrl) return null;

  try {
    const url = new URL(fileUrl);

    const publicMarker =
      "/storage/v1/object/public/finance-documents/";
    const publicMarkerIndex =
      url.pathname.indexOf(publicMarker);

    if (publicMarkerIndex !== -1) {
      const rawPath = url.pathname.slice(
        publicMarkerIndex + publicMarker.length
      );

      return decodeURIComponent(rawPath);
    }

    const signedMarker =
      "/storage/v1/object/sign/finance-documents/";
    const signedMarkerIndex =
      url.pathname.indexOf(signedMarker);

    if (signedMarkerIndex !== -1) {
      const rawPath = url.pathname.slice(
        signedMarkerIndex + signedMarker.length
      );

      return decodeURIComponent(rawPath);
    }

    return null;
  } catch {
    const marker = "finance-documents/";
    const markerIndex = fileUrl.indexOf(marker);

    if (markerIndex !== -1) {
      return decodeURIComponent(
        fileUrl.slice(markerIndex + marker.length)
      );
    }

    return null;
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const documentId = Number(id);

    if (!documentId || Number.isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document id." },
        { status: 400 }
      );
    }

    const authHeader =
      req.headers.get("authorization") || "";

    const token = authHeader
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("user_profiles")
      .select(
        "id, auth_user_id, company_id, role, status"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 403 }
      );
    }

    if (profile.status !== "Active") {
      return NextResponse.json(
        { error: "User profile is not active." },
        { status: 403 }
      );
    }

    const {
      data: document,
      error: documentError,
    } = await supabaseAdmin
      .from("finance_documents")
      .select(
        "id, company_id, lead_id, document_name, file_path, file_url"
      )
      .eq("id", documentId)
      .maybeSingle();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    if (document.company_id !== profile.company_id) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to access this document.",
        },
        { status: 403 }
      );
    }

    /*
     * Finance uploads store the actual bucket path in file_path.
     * Older records may only have file_url, so keep that as a fallback.
     */
    const filePath =
      document.file_path?.trim() ||
      extractFinanceDocumentPath(
        document.file_url
      );

    if (!filePath) {
      return NextResponse.json(
        {
          error:
            "Could not determine document storage path.",
        },
        { status: 400 }
      );
    }

    const requestUrl = new URL(req.url);
    const mode =
      requestUrl.searchParams.get("mode");

    const {
      data: signedData,
      error: signedError,
    } = await supabaseAdmin.storage
      .from("finance-documents")
      .createSignedUrl(
        filePath,
        60 * 5,
        {
          download:
            mode === "download"
              ? document.document_name ||
                "document"
              : false,
        }
      );

    if (
      signedError ||
      !signedData?.signedUrl
    ) {
      return NextResponse.json(
        {
          error:
            signedError?.message ||
            "Could not create secure document link.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      expiresInSeconds: 60 * 5,
    });
  } catch (error) {
    console.error(
      "Signed document URL error:",
      error
    );

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
