"use client";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { canAccessRole } from "@/lib/auth";
import ReadOnlyNotice from "@/components/ReadOnlyNotice";
import WriteAccessGuard from "@/components/WriteAccessGuard";

type UserProfile = {
  id: number;
  auth_user_id: string | null;
  company_id: number;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  created_at: string | null;
};

const roles = ["Admin", "Manager", "Sales", "Finance"];

export default function UsersPage() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
const [showInviteModal, setShowInviteModal] = useState(false);
const [inviteName, setInviteName] = useState("");
const [inviteEmail, setInviteEmail] = useState("");
const [inviteRole, setInviteRole] = useState("Sales");
  async function fetchUsers() {
    if (!profile?.company_id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error loading users:", error.message);
      setUsers([]);
    } else {
      setUsers(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, [profile?.company_id]);

  async function updateUserRole(userId: number, role: string) {
    const { error } = await supabase
      .from("user_profiles")
      .update({ role })
      .eq("id", userId)
      .eq("company_id", profile?.company_id);

    if (error) {
      alert("Error updating role: " + error.message);
      return;
    }

    fetchUsers();
  }

  async function updateUserStatus(userId: number, status: string) {
    const { error } = await supabase
      .from("user_profiles")
      .update({ status })
      .eq("id", userId)
      .eq("company_id", profile?.company_id);

    if (error) {
      alert("Error updating status: " + error.message);
      return;
    }

    fetchUsers();
  }

  if (!canAccessRole(profile?.role, "userManagement")) {
    return (
      <DashboardLayout>
        <div className="rounded-xl bg-white p-10 shadow">
          <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
          <p className="mt-3 text-slate-500">
            You do not have permission to manage users.
          </p>
        </div>
      </DashboardLayout>
    );
  }

async function handleInviteUser() {
  if (!inviteName.trim() || !inviteEmail.trim()) {
    alert("Please enter the user's name and email.");
    return;
  }

  try {
    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        company_id: profile?.company_id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Failed to create user.");
      return;
    }

    alert(
      `User created successfully.\n\nTemporary Password:\n${result.temporaryPassword}`
    );

    setShowInviteModal(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("Sales");

    fetchUsers();
  } catch (error) {
    alert("Unexpected error creating user.");
  }
}

 return (
  <DashboardLayout>
    <PageAccessGuard module="userManagement">
      <ReadOnlyNotice />

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        DealFlow now uses four practical roles for small dealerships:
        Admin, Manager, Sales and Finance. Inventory responsibilities are
        handled by Admin or Manager.
      </div>

      <div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold text-slate-800">
      User Management
    </h1>
    <p className="text-slate-500">
      Manage dealership users, roles and account status
    </p>
  </div>

  <WriteAccessGuard>
<button
    onClick={() => setShowInviteModal(true)}
    className="rounded-lg bg-slate-900 px-5 py-3 text-white hover:bg-slate-700"
  >
    + Invite User
  </button></WriteAccessGuard>
</div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        {loading ? (
          <div className="p-6 text-slate-500">Loading users...</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {user.full_name || "Unnamed User"}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {user.email}
                  </td>

                  <td className="px-6 py-4">
                    <select
                      value={user.role || "Sales"}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-6 py-4">
                    <select
                      value={user.status || "Active"}
                      onChange={(e) =>
                        updateUserStatus(user.id, e.target.value)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-ZA")
                      : "-"}
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

{showInviteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
      <h2 className="text-2xl font-bold text-slate-800">
        Invite New User
      </h2>

      <p className="mt-1 text-slate-500">
        Add a dealership staff member and assign their role.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-600">
            Full Name
          </label>
          <input
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="e.g. Sarah Jacobs"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600">
            Email Address
          </label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="e.g. sarah@dealer.co.za"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600">
            Role
          </label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 p-3"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <WriteAccessGuard>
<button
          onClick={() => setShowInviteModal(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button></WriteAccessGuard>

        <WriteAccessGuard>
<button
          onClick={handleInviteUser}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Continue
        </button></WriteAccessGuard>
      </div>
    </div>
  </div>
)}
    </PageAccessGuard>

    </DashboardLayout>
  );
}