"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getStoredUser, login } from "@/lib/authApi";

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const user = getStoredUser();

    if (user) {
      router.replace("/");
    }
  }, [router]);

  function validateForm() {
    const errors: FieldErrors = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function getFriendlyLoginError(error: unknown) {
    if (!(error instanceof Error)) {
      return "Unable to sign in. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("load failed")
    ) {
      return "Unable to connect to HexaGuard API. Please try again.";
    }

    return "Invalid email or password. Please check your credentials and try again.";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
      });

      router.replace("/");
    } catch (error) {
      setErrorMessage(getFriendlyLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCoreShell
      footerLeft={<Link href="/forgot-password">FORGOT PASSWORD?</Link>}
      footerRight={<Link href="/register">Create account</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <CoreField label="EMAIL" error={fieldErrors.email}>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((previous) => ({ ...previous, email: undefined }));
            }}
            placeholder="name@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            className={coreInputClass(Boolean(fieldErrors.email))}
          />
        </CoreField>

        <CoreField label="PASSWORD" error={fieldErrors.password}>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((previous) => ({ ...previous, password: undefined }));
              }}
              placeholder="••••••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              className={`${coreInputClass(Boolean(fieldErrors.password))} pr-16`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#ff3434] transition hover:text-[#ff8a8a]"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
        </CoreField>

        {errorMessage ? <CoreError message={errorMessage} /> : null}

        <CoreButton disabled={isSubmitting}>
          {isSubmitting ? "SIGNING IN..." : "SIGN IN"}
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
          <h1 className="font-mono text-[28px] font-black uppercase leading-none tracking-[-0.06em]">
            <span className="text-white">HEXAGUARD</span>
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

function CoreField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] font-black uppercase tracking-[0.18em] text-[#a6a6a6]">
        {label}
      </span>
      {children}
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#ff8a8a]">{error}</p>
      ) : null}
    </label>
  );
}

function CoreButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
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
    hasError
      ? "border-[#ff3434]/60 focus:border-[#ff3434]"
      : "border-white/[0.09] focus:border-[#ff3434]/55",
  ].join(" ");
}
