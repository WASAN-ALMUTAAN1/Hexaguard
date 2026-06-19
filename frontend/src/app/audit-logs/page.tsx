"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authApi";

type AuditLog = {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        const response = await authFetch("/audit-logs");
        const data = await response.json();
        setLogs(data.items || []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load audit logs."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadAuditLogs();
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-8 sm:px-6 xl:px-8">
      <section className="rounded-[30px] border border-white/[0.08] bg-[#27292a] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] lg:p-8">
        <div>
          <span className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Admin Monitoring
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white">
            Audit Logs
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8b8b8]">
            Review important backend actions such as user changes, dataset uploads,
            and security-related activity.
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[#ff3434]/30 bg-[#ff3434]/10 px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-[22px] border border-white/[0.08]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[#1f2122] text-[11px] uppercase tracking-[0.14em] text-[#8d8d8d]">
                <tr>
                  <th className="px-5 py-4">Time</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Entity</th>
                  <th className="px-5 py-4">Entity ID</th>
                  <th className="px-5 py-4">Metadata</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.06]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[#9f9f9f]">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[#9f9f9f]">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="bg-[#1f2122] transition hover:bg-[#252728]">
                      <td className="px-5 py-4 text-[#d7d7d7]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">{log.action}</td>
                      <td className="px-5 py-4 text-[#d7d7d7]">{log.entity_type || "—"}</td>
                      <td className="px-5 py-4 font-mono text-xs text-[#9f9f9f]">
                        {log.entity_id || "—"}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-[#9f9f9f]">
                        {log.metadata_json ? JSON.stringify(log.metadata_json) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

