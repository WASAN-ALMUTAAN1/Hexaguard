"use client";

import Link from "next/link";
import { useState } from "react";
import { saveLatestReport } from "../lib/hexaguardApi";

export default function ReportActions({
  reportType,
  report,
}: {
  reportType: string;
  report: any;
}) {
  const [message, setMessage] = useState("");

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setMessage("Report JSON copied.");
  }

  function handleDownload() {
    const savedReport = {
      type: reportType,
      saved_at: new Date().toISOString(),
      report,
    };

    const blob = new Blob([JSON.stringify(savedReport, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `hexaguard-${reportType}-report-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    setMessage("Report downloaded.");
  }

  function handleSave() {
    saveLatestReport(reportType, report);
    setMessage("Report saved as latest report.");
  }

  return (
    <div className="mt-4 rounded-[14px] border border-[#353637] bg-[#1f2122] p-4">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/reports"
          onClick={handleSave}
          className="rounded-[14px] bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
        >
          Open Report
        </Link>

        <button
          onClick={handleCopy}
          className="rounded-[14px] border border-[#353637] px-4 py-2 text-sm font-bold text-white hover:bg-[#303234]"
        >
          Copy JSON
        </button>

        <button
          onClick={handleDownload}
          className="rounded-[14px] border border-[#353637] px-4 py-2 text-sm font-bold text-white hover:bg-[#303234]"
        >
          Download JSON
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-[#d4d4d4]">{message}</p>}
    </div>
  );
}
