import { Severity } from "../types/scenario";

const severityClasses: Record<Severity, string> = {
  Low: "border-emerald-500/40 bg-[#30d158]/10 text-[#30d158]",
  Medium: "border-yellow-500/40 bg-[#ffd166]/10 text-[#ffd166]",
  High: "border-orange-500/40 bg-[#ffb347]/10 text-[#ffb347]",
  Critical: "border-red-500/40 bg-[#ff3434]/10 text-[#ff3434]",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${severityClasses[severity]}`}
    >
      {severity}
    </span>
  );
}
