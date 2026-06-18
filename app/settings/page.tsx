"use client";

import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";

import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

type Company = {
  id: number;
  company_name: string | null;
  logo_url: string | null;
  theme_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
};

type SaveNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

const LOGO_BUCKET = "company-assets";

const themes = [
  {
    name: "Slate",
    primary_color: "#0f172a",
    accent_color: "#2563eb",
    sidebar_color: "#0f172a",
  },
  {
    name: "Blue",
    primary_color: "#1e3a8a",
    accent_color: "#2563eb",
    sidebar_color: "#1e3a8a",
  },
  {
    name: "Green",
    primary_color: "#14532d",
    accent_color: "#16a34a",
    sidebar_color: "#14532d",
  },
  {
    name: "Orange",
    primary_color: "#9a3412",
    accent_color: "#f97316",
    sidebar_color: "#9a3412",
  },
  {
    name: "Purple",
    primary_color: "#581c87",
    accent_color: "#9333ea",
    sidebar_color: "#581c87",
  },
];

function getFileExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (!ext) return "png";

  if (["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) {
    return ext;
  }

  return "png";
}

export default function SettingsPage() {
  const { profile } = useAuth();

  const [settings, setSettings] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("DealFlow CRM");
  const [themeName, setThemeName] = useState("Slate");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<SaveNotice | null>(null);

  const selectedTheme =
    themes.find((theme) => theme.name === themeName) || themes[0];

  const localLogoPreview = useMemo(() => {
    if (!logoFile) return null;

    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
    };
  }, [localLogoPreview]);

  async function fetchSettings() {
    if (!profile?.company_id) return;

    setLoading(true);
    setNotice(null);

    const { data, error } = await supabase
      .from("companies")
      .select(
        "id, company_name, logo_url, theme_name, primary_color, accent_color, sidebar_color"
      )
      .eq("id", profile.company_id)
      .single<Company>();

    if (error) {
      console.error("Error loading company settings:", error.message);
      setNotice({
        tone: "error",
        message: `Could not load company settings: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(data);
      setCompanyName(data.company_name || "DealFlow CRM");
      setThemeName(data.theme_name || "Slate");
      setLogoUrl(data.logo_url);
    }

    setLoading(false);
  }

  useEffect(() => {
    void fetchSettings();
  }, [profile?.company_id]);

  function handleLogoSelected(file: File | undefined) {
    if (!file) return;

    const maxSizeMb = 2;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (!file.type.startsWith("image/")) {
      setNotice({
        tone: "error",
        message: "Please select an image file for the company logo.",
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      setNotice({
        tone: "error",
        message: `Logo file is too large. Please upload a file smaller than ${maxSizeMb}MB.`,
      });
      return;
    }

    setLogoFile(file);
    setNotice({
      tone: "info",
      message: "Logo selected. Click Save Settings to upload and apply it.",
    });
  }

  async function uploadLogo() {
    if (!logoFile) return logoUrl;

    if (!profile?.company_id) {
      throw new Error("Company profile is not available yet.");
    }

    const fileExt = getFileExtension(logoFile.name);
    const filePath = `logos/company-${profile.company_id}/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(filePath, logoFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: logoFile.type || undefined,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveSettings() {
    if (!profile?.company_id) return;

    setSaving(true);
    setNotice(null);

    try {
      const uploadedLogoUrl = await uploadLogo();

      const payload = {
        company_name: companyName.trim() || "DealFlow CRM",
        logo_url: uploadedLogoUrl,
        theme_name: selectedTheme.name,
        primary_color: selectedTheme.primary_color,
        accent_color: selectedTheme.accent_color,
        sidebar_color: selectedTheme.sidebar_color,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", profile.company_id);

      if (error) {
        throw new Error(error.message);
      }

      setLogoFile(null);
      setLogoUrl(uploadedLogoUrl);
      setNotice({
        tone: "success",
        message:
          "Company settings saved. Branding will refresh across DealFlow.",
      });

      window.dispatchEvent(new Event("dealflow-branding-updated"));
      await fetchSettings();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while saving settings.";

      setNotice({
        tone: "error",
        message: `Settings could not be saved: ${message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canAccessRole(profile?.role, "settings")) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800">
            Access Denied
          </h1>

          <p className="mt-3 text-slate-500">
            You do not have permission to access Settings.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const noticeClasses =
    notice?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice?.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  const previewLogo = localLogoPreview || logoUrl;

  return (
    <DashboardLayout>
      <PageAccessGuard module="settings">
        <ReadOnlyNotice />

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
                  Company setup
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  Settings
                </h1>

                <p className="mt-2 max-w-2xl text-slate-500">
                  Manage the dealership name, logo and theme used across
                  DealFlow.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Active company ID:{" "}
                <span className="font-bold text-slate-900">
                  {profile?.company_id || "-"}
                </span>
              </div>
            </div>
          </div>

          {notice && (
            <div className={`rounded-2xl border p-4 text-sm ${noticeClasses}`}>
              <div className="flex items-start justify-between gap-4">
                <p className="leading-6">{notice.message}</p>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="rounded-lg px-2 py-1 font-bold hover:bg-black/5"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">
                Company Branding
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                The logo is stored in Supabase Storage under{" "}
                <span className="font-semibold text-slate-700">
                  company-assets/logos
                </span>
                .
              </p>

              {loading ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  Loading company settings...
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Company Logo
                    </label>

                    <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={(e) => handleLogoSelected(e.target.files?.[0])}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                      />

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Recommended: PNG, JPG, WebP or SVG. Keep the file under
                        2MB for best performance.
                      </p>

                      {logoFile && (
                        <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                          Selected: {logoFile.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Theme Palette
                    </label>
                    <select
                      value={themeName}
                      onChange={(e) => setThemeName(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      {themes.map((theme) => (
                        <option key={theme.name} value={theme.name}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <WriteAccessGuard>
                    <button
                      type="button"
                      onClick={() => void saveSettings()}
                      disabled={saving}
                      className="rounded-2xl px-5 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: selectedTheme.primary_color,
                      }}
                    >
                      {saving ? "Saving Settings..." : "Save Settings"}
                    </button>
                  </WriteAccessGuard>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">
                Live Preview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Preview before saving. The sidebar updates after save.
              </p>

              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                <div
                  className="p-5 text-white"
                  style={{
                    backgroundColor: selectedTheme.sidebar_color,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {previewLogo ? (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2">
                        <img
                          src={previewLogo}
                          alt="Company Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">
                        {(companyName || "D").charAt(0)}
                      </div>
                    )}

                    <div>
                      <p className="text-lg font-black leading-tight">
                        {companyName || "DealFlow CRM"}
                      </p>
                      <p className="text-xs text-white/70">
                        {selectedTheme.name} theme
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-5">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-900">
                      Dashboard Preview
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Buttons and highlights use the selected theme.
                    </p>

                    <div className="mt-4 flex gap-2">
                      <div
                        className="h-9 w-9 rounded-full"
                        style={{ backgroundColor: selectedTheme.primary_color }}
                      />
                      <div
                        className="h-9 w-9 rounded-full"
                        style={{ backgroundColor: selectedTheme.accent_color }}
                      />
                      <div
                        className="h-9 w-9 rounded-full"
                        style={{ backgroundColor: selectedTheme.sidebar_color }}
                      />
                    </div>

                    <button
                      type="button"
                      className="mt-5 rounded-xl px-4 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: selectedTheme.primary_color }}
                    >
                      Example Action
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageAccessGuard>
    </DashboardLayout>
  );
}
