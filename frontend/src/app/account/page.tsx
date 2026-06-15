"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  changePassword,
  getMyProfile,
  getStoredUser,
  logout,
  updateMyProfile,
} from "@/lib/authApi";
import type { AuthUser } from "@/types/auth";

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    async function loadProfile() {
      try {
        const profile = await getMyProfile();

        setUser(profile);
        setFullName(profile.full_name);
        setOrganizationName(profile.organization_name || "");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load account profile."
        );
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingProfile(true);
    setProfileMessage("");
    setErrorMessage("");

    try {
      const updatedUser = await updateMyProfile({
        full_name: fullName,
        organization_name: organizationName || null,
      });

      setUser(updatedUser);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsChangingPassword(true);
    setPasswordMessage("");
    setErrorMessage("");

    try {
      const response = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordMessage(response.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to change password."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-[1720px] items-center justify-center px-4 py-10 sm:px-6 xl:px-8">
        <div className="rounded-[26px] border border-white/[0.08] bg-[#27292a] px-6 py-5 text-sm font-semibold text-[#d7d7d7]">
          Loading account workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-8 sm:px-6 xl:px-8">
      <section className="rounded-[30px] border border-white/[0.08] bg-[#27292a] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] lg:p-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-[#ff3434]/30 bg-[#ff3434]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ff3434]">
              Account Center
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white">
              Profile and security settings
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8b8b8]">
              Manage your HexaGuard identity, organization details, password,
              and authenticated session from one workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="h-11 rounded-2xl border border-[#ff3434]/35 bg-[#ff3434]/10 px-5 text-sm font-black text-[#ff8a8a] transition hover:bg-[#ff3434]/15"
          >
            Log out
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <AccountMetric label="Email" value={user?.email || "—"} />
          <AccountMetric label="Role" value={user?.role || "—"} />
          <AccountMetric label="Status" value={user?.status || "—"} />
          <AccountMetric
            label="Organization"
            value={user?.organization_name || "Not set"}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <form
            onSubmit={handleUpdateProfile}
            className="rounded-[26px] border border-white/[0.08] bg-[#1f2122] p-6"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#727272]">
                Profile
              </p>
              <h2 className="mt-2 text-xl font-black text-white">
                Account details
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#9f9f9f]">
                Update your display name and organization information.
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                  Organization
                </span>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
                />
              </label>

              {profileMessage ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {profileMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="h-12 rounded-2xl bg-[#ff3434] px-5 text-sm font-black text-white shadow-[0_0_24px_rgba(255,52,52,0.22)] transition hover:bg-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="rounded-[26px] border border-white/[0.08] bg-[#1f2122] p-6"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#727272]">
                Security
              </p>
              <h2 className="mt-2 text-xl font-black text-white">
                Change password
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#9f9f9f]">
                Changing your password revokes active sessions for better account
                protection.
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                  Current password
                </span>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                  New password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
                />
              </label>

              {passwordMessage ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {passwordMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isChangingPassword}
                className="h-12 rounded-2xl border border-[#ff3434]/35 bg-[#ff3434]/10 px-5 text-sm font-black text-[#ff8a8a] transition hover:bg-[#ff3434]/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChangingPassword ? "Updating..." : "Change password"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function AccountMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#1f2122] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#727272]">
        {label}
      </p>
      <p className="mt-3 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}
