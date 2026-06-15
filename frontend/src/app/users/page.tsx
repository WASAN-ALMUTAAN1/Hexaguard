"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { createUser, getStoredUser, listUsers, updateUser } from "@/lib/authApi";
import type { AuthUser } from "@/types/auth";

const ROLE_OPTIONS = [
  "admin",
  "security_engineer",
  "ai_engineer",
  "forward_deployed_engineer",
  "viewer",
];

const STATUS_OPTIONS = ["active", "inactive", "suspended"];

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("ai_engineer");
  const [newOrganization, setNewOrganization] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await listUsers();
      setUsers(response.items);
      setTotalUsers(response.total);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load users."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    if (storedUser.role !== "admin") {
      router.replace("/account");
      return;
    }

    setIsReady(true);
    loadUsers();
  }, [loadUsers, router]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function clearFilters() {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const searchableText = [
        user.full_name,
        user.email,
        user.organization_name || "",
        formatRoleLabel(user.role),
        formatStatusLabel(user.status),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedQuery || searchableText.includes(normalizedQuery);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  function resetCreateForm() {
    setNewFullName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("ai_engineer");
    setNewOrganization("");
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createUser({
        full_name: newFullName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        organization_name: newOrganization || null,
      });

      resetCreateForm();
      setShowCreateForm(false);
      setSuccessMessage("User created successfully.");

      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create user."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateUser(
    userId: string,
    payload: { role?: string; status?: string }
  ) {
    setUpdatingUserId(userId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateUser(userId, payload);
      setSuccessMessage("User updated successfully.");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update user."
      );
    } finally {
      setUpdatingUserId("");
    }
  }

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-[1720px] items-center justify-center px-4 py-10 sm:px-6 xl:px-8">
        <div className="rounded-[26px] border border-white/[0.08] bg-[#27292a] px-6 py-5 text-sm font-semibold text-[#d7d7d7]">
          Checking admin access...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-8 sm:px-6 xl:px-8">
      <section className="rounded-[30px] border border-white/[0.08] bg-[#27292a] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] lg:p-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Admin Workspace
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white">
              User management
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8b8b8]">
              Review team accounts, manage roles, control account status, and add
              new users only when needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-12 min-w-[140px] flex-col items-center justify-center rounded-2xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-5 text-white shadow-[0_0_24px_rgba(255,52,52,0.10)]">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#ffb4b4]">
                Total Users
              </span>
              <span className="mt-0.5 text-lg font-black leading-none text-white">{totalUsers}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="h-12 min-w-[140px] rounded-2xl bg-[#ff3434] px-5 text-sm font-black text-white shadow-[0_0_24px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4d4d]"
            >
              {showCreateForm ? "Close" : "Add User"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        {showCreateForm ? (
          <form
            onSubmit={handleCreateUser}
            className="mt-8 rounded-[26px] border border-white/[0.08] bg-[#1f2122] p-6"
          >
            <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#727272]">
                Add User
              </p>
              <h2 className="text-xl font-black text-white">
                Create a new team member
              </h2>
              <p className="text-sm leading-6 text-[#9f9f9f]">
                Use this form only when you need to add a new account to the
                HexaGuard workspace.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <TextField
                label="Full name"
                value={newFullName}
                onChange={setNewFullName}
                placeholder="Team member name"
                required
              />

              <TextField
                label="Email"
                type="email"
                value={newEmail}
                onChange={setNewEmail}
                placeholder="name@example.com"
                required
              />

              <TextField
                label="Temporary password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimum 8 characters"
                required
              />

              <TextField
                label="Organization"
                value={newOrganization}
                onChange={setNewOrganization}
                placeholder="Organization"
              />

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                  Role
                </span>
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition focus:border-[#ff3434]/45"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateForm(false);
                }}
                className="h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-bold text-[#d7d7d7] transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isCreating}
                className="h-11 rounded-2xl bg-[#ff3434] px-5 text-sm font-black text-white transition hover:bg-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        ) : null}

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-[#1f2122] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-2 text-xl font-black text-white">
                Existing users
              </h2>
            </div>

            <form onSubmit={handleSearch} className="flex flex-wrap items-center justify-end gap-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, or organization"
                className="h-11 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45 lg:w-[310px]"
              />

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="h-11 rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm font-bold text-white outline-none transition focus:border-[#ff3434]/45"
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {formatRoleLabel(role)}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm font-bold text-white outline-none transition focus:border-[#ff3434]/45"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-black text-[#d7d7d7] transition hover:bg-white/[0.07]"
              >
                Clear
              </button>
            </form>
          </div>

          <div className="mt-6 overflow-hidden rounded-[22px] border border-white/[0.08]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-center text-sm">
                <thead className="bg-[#27292a] text-[11px] uppercase tracking-[0.14em] text-[#8d8d8d]">
                  <tr>
                    <th className="px-5 py-4 text-center">User</th>
                    <th className="px-5 py-4 text-center">Role</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-center">Organization</th>
                    <th className="px-5 py-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/[0.06]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[#9f9f9f]">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[#9f9f9f]">
                        No users match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isUpdating={updatingUserId === user.id}
                        onUpdate={handleUpdateUser}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function UserRow({
  user,
  isUpdating,
  onUpdate,
}: {
  user: AuthUser;
  isUpdating: boolean;
  onUpdate: (userId: string, payload: { role?: string; status?: string }) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  useEffect(() => {
    setRole(user.role);
    setStatus(user.status);
  }, [user.role, user.status]);

  const hasChanges = role !== user.role || status !== user.status;

  return (
    <tr className="bg-[#1f2122] align-middle text-center transition hover:bg-[#252728]">
      <td className="px-5 py-5 text-center">
        <p className="font-black text-white">{user.full_name}</p>
        <p className="mt-1 text-xs text-[#9f9f9f]">{user.email}</p>
      </td>

      <td className="px-5 py-5">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#27292a] px-3 text-center text-xs font-bold text-white outline-none focus:border-[#ff3434]/45"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatRoleLabel(option)}
            </option>
          ))}
        </select>
      </td>

      <td className="px-5 py-5">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#27292a] px-3 text-center text-xs font-bold text-white outline-none focus:border-[#ff3434]/45"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatStatusLabel(option)}
            </option>
          ))}
        </select>
      </td>

      <td className="px-5 py-5 text-center text-sm text-[#d7d7d7]">
        {user.organization_name || "—"}
      </td>

      <td className="px-5 py-5 text-center">
        <button
          type="button"
          disabled={isUpdating || !hasChanges}
          onClick={() => onUpdate(user.id, { role, status })}
          className="h-10 rounded-xl bg-[#ff3434] px-4 text-xs font-black text-white transition hover:bg-[#ff4d4d] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-[#777]"
        >
          {isUpdating ? "Saving..." : hasChanges ? "Save" : "Saved"}
        </button>
      </td>
    </tr>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
        {label}
      </span>
      <input
        type={type}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
      />
    </label>
  );
}

function formatRoleLabel(role: string) {
  const roleMap: Record<string, string> = {
    admin: "Admin",
    security_engineer: "Security Engineer",
    ai_engineer: "AI Engineer",
    forward_deployed_engineer: "FDE",
    viewer: "Viewer",
  };

  return roleMap[role] || role;
}

function formatStatusLabel(status: string) {
  const statusMap: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
  };

  return statusMap[status] || status;
}
