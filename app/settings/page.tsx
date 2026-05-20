"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";

import { canAccessRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type Company = {
  id: number;
  company_name: string | null;
  logo_url: string | null;
  theme_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
};

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("DealFlow CRM");
  const [themeName, setThemeName] = useState("Slate");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
const { profile } = useAuth();
  async function fetchSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", 1)
      .single<Company>();

    if (error) {
      console.error("Error loading company settings:", error.message);
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
    fetchSettings();
  }, []);

  async function uploadLogo() {
    if (!logoFile) return logoUrl;

    const fileExt = logoFile.name.split(".").pop();
    const filePath = `logos/company-logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(filePath, logoFile, {
        upsert: true,
      });

    if (uploadError) {
      alert("Logo upload failed: " + uploadError.message);
      return logoUrl;
    }

    const { data } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveSettings() {
    const selectedTheme =
      themes.find((theme) => theme.name === themeName) || themes[0];

    const uploadedLogoUrl = await uploadLogo();

    const payload = {
      company_name: companyName,
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
      .eq("id", settings?.id || 1);

    if (error) {
      alert("Error saving company settings: " + error.message);
      return;
    }

    alert("Company settings saved successfully.");
    setLogoFile(null);
    window.dispatchEvent(new Event("dealflow-branding-updated"));
    fetchSettings();
  }

  

if (!canAccessRole(profile?.role, "settings")) {
  return (
    <DashboardLayout>
      <div className="rounded-xl bg-white p-10 shadow">
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500">
          Manage company branding and theme preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-800">
              Company Branding
            </h2>

            {loading ? (
              <p className="mt-4 text-slate-500">Loading settings...</p>
            ) : (
              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Company Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setLogoFile(e.target.files[0]);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Theme Palette
                  </label>
                  <select
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                  >
                    {themes.map((theme) => (
                      <option key={theme.name} value={theme.name}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={saveSettings}
                  className="rounded-lg px-5 py-3 text-white"
                  style={{
                    backgroundColor:
                      themes.find((theme) => theme.name === themeName)
                        ?.primary_color || "#0f172a",
                  }}
                >
                  Save Settings
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-800">Preview</h2>

          <div className="mt-5 rounded-xl border border-slate-200 p-5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Company Logo"
                className="mb-4 max-h-20 object-contain"
              />
            ) : (
              <div className="mb-4 flex h-20 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                No logo uploaded
              </div>
            )}

            <p className="text-lg font-bold text-slate-800">{companyName}</p>
            <p className="text-sm text-slate-500">{themeName} Theme</p>

            <div className="mt-5 flex gap-3">
              {themes
                .filter((theme) => theme.name === themeName)
                .map((theme) => (
                  <div key={theme.name} className="flex gap-2">
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: theme.primary_color }}
                    />
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: theme.accent_color }}
                    />
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: theme.sidebar_color }}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}