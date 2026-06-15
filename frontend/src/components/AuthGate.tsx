"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { validateStoredSession } from "@/lib/authApi";

const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      setIsChecking(true);

      const isPublicRoute = publicRoutes.some((route) => pathname === route);
      const profile = await validateStoredSession();

      if (!isMounted) {
        return;
      }

      if (!profile && !isPublicRoute) {
        router.replace("/login");
        return;
      }

      if (profile && ["/login", "/register"].includes(pathname)) {
        router.replace("/");
        return;
      }

      if (profile && pathname.startsWith("/users") && profile.role !== "admin") {
        router.replace("/account");
        return;
      }

      setIsChecking(false);
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f2122] px-4">
        <div className="rounded-[26px] border border-white/[0.08] bg-[#27292a] px-6 py-5 text-sm font-semibold text-[#d7d7d7] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
          Checking secure session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
