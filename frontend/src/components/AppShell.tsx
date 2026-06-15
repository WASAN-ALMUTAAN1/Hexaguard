"use client";

import { ReactNode, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarClosed, setSidebarClosed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("hexaguard-sidebar-closed");
    setSidebarClosed(saved === "true");
  }, []);

  function toggleSidebar() {
    setSidebarClosed((previous) => {
      const next = !previous;
      window.localStorage.setItem("hexaguard-sidebar-closed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#1f2122] text-white">
      <Sidebar
        closed={sidebarClosed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          sidebarClosed ? "lg:pl-0" : "lg:pl-80"
        }`}
      >
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#353637] bg-[#1f2122]/95 px-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-[14px] border border-[#353637] bg-[#27292a] px-3 py-2 text-sm font-black text-white transition hover:border-red-400 hover:text-[#4ad7ff] lg:hidden"
              aria-label="Open sidebar"
            >
              ☰
            </button>

            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden rounded-[14px] border border-[#353637] bg-[#27292a] px-3 py-2 text-sm font-black text-white transition hover:border-red-400 hover:text-[#4ad7ff] lg:inline-flex"
              aria-label={sidebarClosed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarClosed ? "☰ Show Sidebar" : "← Hide Sidebar"}
            </button>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#4ad7ff]">
                HEXAGUARD
              </p>
              <p className="text-xs text-[#727272]">
                AI Red Teaming & Safety Operations
              </p>
            </div>
          </div>

          <div className="hidden rounded-full border border-emerald-400/30 bg-[#30d158]/10 px-4 py-2 text-xs font-black text-[#30d158] md:block">
            Secure Client Workspace
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
