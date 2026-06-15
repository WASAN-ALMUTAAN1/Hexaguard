"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { register } from "@/lib/authApi";

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validateForm() {
    const errors: FieldErrors = {};
    const cleanEmail = email.trim();

    if (!fullName.trim()) errors.fullName = "Full name is required.";

    if (!cleanEmail) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        organization_name: organizationName.trim() || null,
      });

      router.replace("/");
    } catch {
      setErrorMessage("Unable to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCoreShell
      footerLeft={<Link href="/login">RETURN TO LOGIN</Link>}
      footerRight={<Link href="/forgot-password">RECOVERY</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <CoreField label="FULL NAME" error={fieldErrors.fullName}>
          <input
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setFieldErrors((previous) => ({ ...previous, fullName: undefined }));
            }}
            placeholder="Team member name"
            className={coreInputClass(Boolean(fieldErrors.fullName))}
          />
        </CoreField>

        <CoreField label="EMAIL" error={fieldErrors.email}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((previous) => ({ ...previous, email: undefined }));
            }}
            placeholder="operator@hexaguard.ai"
            className={coreInputClass(Boolean(fieldErrors.email))}
          />
        </CoreField>

        <CoreField label="ORGANIZATION" error={undefined}>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Organization"
            className={coreInputClass(false)}
          />
        </CoreField>

        <CoreField label="PASSWORD" error={fieldErrors.password}>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((previous) => ({ ...previous, password: undefined }));
            }}
            placeholder="Minimum 8 characters"
            className={coreInputClass(Boolean(fieldErrors.password))}
          />
        </CoreField>

        <CoreField label="CONFIRM PASSWORD" error={fieldErrors.confirmPassword}>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFieldErrors((previous) => ({
                ...previous,
                confirmPassword: undefined,
              }));
            }}
            placeholder="Repeat password"
            className={coreInputClass(Boolean(fieldErrors.confirmPassword))}
          />
        </CoreField>

        {errorMessage ? <CoreError message={errorMessage} /> : null}

        <CoreButton disabled={isSubmitting}>
          {isSubmitting ? "CREATING..." : "CREATE ACCOUNT"}
        </CoreButton>
      </form>
    </AuthCoreShell>
  );
}

function AuthCoreShell({
  children,
  footerLeft,
  footerRight,
}: {
  children: React.ReactNode;
  footerLeft: React.ReactNode;
  footerRight: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070909] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_17%_18%,rgba(255,52,52,.15),transparent_32%),radial-gradient(circle_at_84%_50%,rgba(74,215,255,.10),transparent_34%)]" />

      <section className="relative w-full max-w-[420px] rounded-[26px] border border-white/[0.08] bg-[#111314]/90 px-11 py-10 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-[24px] border border-[#ff3434]/55 bg-[#ff3434]/15 text-[28px] font-black tracking-[-0.04em] text-[#ff3434] shadow-[0_0_28px_rgba(255,52,52,0.18)]">
          HX
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-mono text-[28px] font-black uppercase leading-none tracking-[-0.06em] text-white">
            HEXAGUARD
          </h1>
        </div>

        <div className="mt-8">{children}</div>

        <div className="mt-6 flex items-center justify-between gap-4 font-mono text-[10px] font-black tracking-[0.08em]">
          <span className="text-[#ff5d5d] underline-offset-4 transition hover:text-[#ff9a9a] hover:underline">
            {footerLeft}
          </span>
          <span className="text-[#e5e5e5] underline-offset-4 transition hover:text-white hover:underline">
            {footerRight}
          </span>
        </div>
      </section>
    </main>
  );
}

function CoreField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] font-black uppercase tracking-[0.18em] text-[#a6a6a6]">
        {label}
      </span>
      {children}
      {error ? <p className="mt-2 text-xs font-semibold text-[#ff8a8a]">{error}</p> : null}
    </label>
  );
}

function CoreButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="h-[52px] w-full rounded-xl bg-[#ff3434] font-mono text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(255,52,52,0.24)] transition hover:bg-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function CoreError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-4 py-3 text-xs font-semibold leading-5 text-[#ffb4b4]">
      {message}
    </div>
  );
}

function coreInputClass(hasError: boolean) {
  return [
    "h-[50px] w-full rounded-xl border bg-[#090b0c] px-4 font-mono text-sm text-white outline-none transition placeholder:text-[#5f6778]",
    hasError ? "border-[#ff3434]/60 focus:border-[#ff3434]" : "border-white/[0.09] focus:border-[#ff3434]/55",
  ].join(" ");
}
