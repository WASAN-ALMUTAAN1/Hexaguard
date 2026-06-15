"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { resetPassword } from "@/lib/authApi";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await resetPassword({
        token,
        new_password: newPassword,
      });

      setMessage(response.message);
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset password. Please check the reset token."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-[1720px] items-center justify-center px-4 py-10 sm:px-6 xl:px-8">
      <section className="w-full max-w-[760px] rounded-[30px] border border-white/[0.08] bg-[#27292a] p-8 shadow-[0_26px_80px_rgba(0,0,0,0.36)] lg:p-10">
        <div>
          <span className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Password Reset
          </span>

          <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
            Set a new secure password.
          </h1>

          <p className="mt-3 text-sm leading-7 text-[#b8b8b8]">
            Paste the reset token generated from the forgot password page, then
            choose a new password for your HexaGuard account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
              Reset token
            </span>
            <textarea
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste reset token here"
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-white/[0.08] bg-[#1f2122] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
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
                placeholder="Minimum 8 characters"
                className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#1f2122] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8d8d8d]">
                Confirm password
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-[#1f2122] px-4 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ff3434]/45"
              />
            </label>
          </div>

          {message ? (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-[#ff3434] px-5 text-sm font-black text-white shadow-[0_0_24px_rgba(255,52,52,0.22)] transition hover:bg-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-[#9f9f9f] sm:flex-row sm:items-center sm:justify-between">
          <Link href="/forgot-password" className="font-bold text-[#d7d7d7] hover:text-white">
            Request a new token
          </Link>

          <Link href="/login" className="font-bold text-[#ff6b6b] hover:text-[#ff8a8a]">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
