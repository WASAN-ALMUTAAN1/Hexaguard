"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { clearAuthSession, getStoredUser, logout } from "@/lib/authApi";
import type { AuthUser } from "@/types/auth";

type SidebarProps = {
  closed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

const mainNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/manual-red-team", label: "Manual" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/models", label: "Models" },
];

export default function Sidebar({
  closed = false,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setAccountOpen(false);

    function syncAuthState() {
      setUser(getStoredUser());
    }

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("focus", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("focus", syncAuthState);
    };
  }, [pathname]);

  if (isAuthPage) {
    return null;
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      clearAuthSession();
    } finally {
      setUser(null);
      setAccountOpen(false);
      onCloseMobile?.();
      window.location.href = "/login";
    }
  }

  const isAccountActive =
    pathname === "/account" || pathname.startsWith("/users");

  return (
    <header
      data-sidebar-closed={closed}
      data-mobile-open={mobileOpen}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#1f2122]/96 px-4 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:px-6 xl:px-8"
    >
      <div className="mx-auto flex max-w-[1720px] flex-col gap-3 xl:min-h-[60px] xl:flex-row xl:items-center xl:gap-5">
        <Link
          href="/"
          onClick={onCloseMobile}
          className="flex shrink-0 items-center gap-3"
        >
          <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-[#ff3434]/40 bg-[#ff3434]/12 font-mono text-xs font-black text-[#ff3434] shadow-[0_0_20px_rgba(255,52,52,0.14)]">
            HX
          </span>

          <div className="leading-none">
            <p className="text-[15px] font-black tracking-[-0.2px] text-white">
              HexaGuard
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#727272]">
              AI Security
            </p>
          </div>
        </Link>

        <nav className="flex min-w-0 flex-wrap items-center justify-start gap-1 xl:ml-auto xl:flex-nowrap xl:justify-end">
          {mainNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={
                  isActive
                    ? "shrink-0 rounded-full bg-[#ff3434] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_16px_rgba(255,52,52,0.20)]"
                    : "shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#a9a9a9] transition hover:bg-white/[0.05] hover:text-white"
                }
              >
                {item.label}
              </Link>
            );
          })}

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((value) => !value)}
                className={
                  isAccountActive
                    ? "shrink-0 rounded-full bg-[#ff3434] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_16px_rgba(255,52,52,0.20)]"
                    : "shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-[#d7d7d7] transition hover:bg-white/[0.06] hover:text-white"
                }
              >
                Account ▾
              </button>

              {accountOpen ? (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#27292a] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                  <Link
                    href="/account"
                    onClick={() => {
                      setAccountOpen(false);
                      onCloseMobile?.();
                    }}
                    className="block rounded-xl px-3 py-2.5 text-xs font-semibold text-[#d7d7d7] transition hover:bg-white/[0.06] hover:text-white"
                  >
                    My Account
                  </Link>

                  {user.role === "admin" ? (
                    <Link
                      href="/users"
                      onClick={() => {
                        setAccountOpen(false);
                        onCloseMobile?.();
                      }}
                      className="block rounded-xl px-3 py-2.5 text-xs font-semibold text-[#d7d7d7] transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Users Management
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#ff8a8a] transition hover:bg-[#ff3434]/10 hover:text-[#ffb4b4]"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link
                href="/login"
                onClick={onCloseMobile}
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-[#d7d7d7] transition hover:bg-white/[0.06] hover:text-white"
              >
                Login
              </Link>

              <Link
                href="/register"
                onClick={onCloseMobile}
                className="shrink-0 rounded-full border border-[#ff3434]/25 bg-[#ff3434]/10 px-2.5 py-1.5 text-xs font-semibold text-[#ff8a8a] transition hover:bg-[#ff3434]/15"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
