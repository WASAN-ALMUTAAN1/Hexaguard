"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Scenario } from "../types/scenario";

type ActiveMenu = {
  scenarioId: number;
  top: number;
  left: number;
};

const MENU_WIDTH = 220;
const MENU_HEIGHT = 268;

export default function ScenarioTable({
  scenarios,
  onView,
  onEdit,
  onDelete,
  onUse,
}: {
  scenarios: Scenario[];
  onView: (scenario: Scenario) => void;
  onEdit: (scenario: Scenario) => void;
  onDelete: (scenario: Scenario) => void;
  onUse: (scenario: Scenario) => void;
}) {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);

  useEffect(() => {
    if (!activeMenu) return;

    function closeOnOutsideClick(event: globalThis.MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-scenario-menu-root='true']")) {
        return;
      }

      setActiveMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    function closeOnViewportChange() {
      setActiveMenu(null);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [activeMenu]);

  function openMenu(event: MouseEvent<HTMLButtonElement>, scenarioId: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp = spaceBelow < MENU_HEIGHT + 16;

    const top = shouldOpenUp
      ? Math.max(12, rect.top - MENU_HEIGHT - 8)
      : rect.bottom + 8;

    const left = Math.min(
      Math.max(12, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 12
    );

    setActiveMenu((current) =>
      current?.scenarioId === scenarioId ? null : { scenarioId, top, left }
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="mt-2 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-7 text-center">
        <h3 className="text-base font-black text-white">No scenarios found</h3>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-[#a9a9a9]">
          Adjust the search filters or create a new reusable attack scenario.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-2 overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#27292a] shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      <div className="overflow-x-auto rounded-[18px]">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
          </colgroup>

          <thead className="bg-[#1f2122]">
            <tr>
              <TableHead className="pl-5 text-left">Scenario</TableHead>
              <TableHead className="text-left">Category</TableHead>
              <TableHead className="text-center">Severity</TableHead>
              <TableHead className="text-center">OWASP</TableHead>
              <TableHead className="text-left">Tags</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Updated</TableHead>
              <TableHead className="pl-2 pr-6 text-center">Actions</TableHead>
            </tr>
          </thead>

          <tbody>
            {scenarios.map((scenario) => {
              const tags = buildScenarioTags(scenario);
              const tagPreview = buildTagPreview(tags);
              const owaspCode = getOwaspCode(scenario.owasp_category);
              const menuOpen = activeMenu?.scenarioId === scenario.id;

              return (
                <tr
                  key={scenario.id}
                  className="border-t border-white/[0.045] transition hover:bg-white/[0.025]"
                >
                  <td className="py-1.5 pl-5 pr-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onView(scenario)}
                      className="block w-full text-left text-[13px] font-bold leading-[18px] text-white transition hover:text-[#4ad7ff]"
                      title={scenario.attack_name}
                    >
                      <span className="line-clamp-2 whitespace-normal break-words">
                        {scenario.attack_name}
                      </span>
                    </button>

                    <p className="mt-0 font-mono text-[10px] text-[#4ad7ff]">
                      {scenario.scenario_id}
                    </p>
                  </td>

                  <td className="px-3 py-1.5 align-middle">
                    <span className="line-clamp-2 max-w-[145px] whitespace-normal break-words text-[12px] font-semibold leading-[18px] text-[#d4d4d4]">
                      {scenario.attack_category}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 text-center align-middle">
                    <CompactSeverityBadge severity={scenario.severity} />
                  </td>

                  <td className="px-3 py-1.5 text-center align-middle">
                    <CompactOwaspBadge
                      value={owaspCode}
                      fullValue={scenario.owasp_category}
                    />
                  </td>

                  <td className="px-3 py-1.5 align-middle">
                    {tagPreview ? (
                      <span
                        className="block w-full truncate whitespace-nowrap font-mono text-[11px] font-semibold leading-[18px] text-[#a9a9a9]"
                        title={tags.join(" · ")}
                      >
                        {tagPreview}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#727272]">No tags</span>
                    )}
                  </td>

                  <td className="px-3 py-1.5 text-center align-middle">
                    <ReviewStatusBadge value={scenario.review_status} />
                  </td>

                  <td className="px-3 py-1.5 text-center align-middle">
                    <span className="font-mono text-[11px] text-[#a9a9a9]">
                      {formatDate(scenario.updated_at)}
                    </span>
                  </td>

                  <td className="py-1.5 pl-2 pr-6 text-center align-middle">
                    <div className="flex justify-center" data-scenario-menu-root="true">
                      <button
                        type="button"
                        onClick={(event) => openMenu(event, scenario.id)}
                        className={
                          menuOpen
                            ? "grid h-6 w-6 place-items-center rounded-[8px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 text-[13px] font-black text-[#4ad7ff] transition"
                            : "grid h-6 w-6 place-items-center rounded-[8px] border border-white/[0.08] bg-[#1f2122] text-[13px] font-black text-[#a9a9a9] transition hover:bg-white/[0.045] hover:text-white"
                        }
                        aria-label="Scenario actions"
                        title="Actions"
                      >
                        ⋯
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeMenu && typeof document !== "undefined"
        ? createPortal(
            <FloatingActionMenu
              activeMenu={activeMenu}
              scenario={
                scenarios.find((item) => item.id === activeMenu.scenarioId) ||
                null
              }
              onClose={() => setActiveMenu(null)}
              onView={onView}
              onUse={onUse}
              onEdit={onEdit}
              onRequestDelete={(scenario) => {
                setActiveMenu(null);
                setDeleteTarget(scenario);
              }}
            />,
            document.body
          )
        : null}

      {deleteTarget && typeof document !== "undefined"
        ? createPortal(
            <DeleteConfirmationDialog
              scenario={deleteTarget}
              onCancel={() => setDeleteTarget(null)}
              onConfirm={() => {
                onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            />,
            document.body
          )
        : null}
    </section>
  );
}

function FloatingActionMenu({
  activeMenu,
  scenario,
  onClose,
  onView,
  onUse,
  onEdit,
  onRequestDelete,
}: {
  activeMenu: ActiveMenu;
  scenario: Scenario | null;
  onClose: () => void;
  onView: (scenario: Scenario) => void;
  onUse: (scenario: Scenario) => void;
  onEdit: (scenario: Scenario) => void;
  onRequestDelete: (scenario: Scenario) => void;
}) {
  if (!scenario) return null;

  const selectedScenario = scenario;

  return (
    <div
      data-scenario-menu-root="true"
      role="menu"
      className="fixed z-[9999] w-[220px] rounded-[10px] border border-white/[0.10] bg-[#1f2122] p-1 shadow-[0_22px_60px_rgba(0,0,0,0.48)]"
      style={{
        top: activeMenu.top,
        left: activeMenu.left,
      }}
    >
      <MenuItem
        icon={<EyeIcon />}
        label="View Details"
        onClick={() => {
          onClose();
          onView(selectedScenario);
        }}
      />

      <MenuItem
        icon={<PlayIcon />}
        label="Use Scenario"
        onClick={() => {
          onClose();
          onUse(selectedScenario);
        }}
      />

      <MenuItem
        icon={<PencilIcon />}
        label="Edit Scenario"
        onClick={() => {
          onClose();
          onEdit(selectedScenario);
        }}
      />

      <MenuDivider />

      <MenuItem
        icon={<CopyIcon />}
        label="Duplicate"
        disabled
        title="Duplicate action is not connected to a backend endpoint yet."
      />

      <MenuItem
        icon={<ArchiveIcon />}
        label="Archive"
        disabled
        title="Archive action is not connected to a backend endpoint yet."
      />

      <MenuDivider />

      <MenuItem
        icon={<TrashIcon />}
        label="Delete"
        danger
        onClick={() => onRequestDelete(selectedScenario)}
      />
    </div>
  );
}

function DeleteConfirmationDialog({
  scenario,
  onCancel,
  onConfirm,
}: {
  scenario: Scenario;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 px-4">
      <div className="w-full max-w-[420px] rounded-[14px] border border-white/[0.10] bg-[#1f2122] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-black text-white">Delete Scenario?</p>

        <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
          This action cannot be undone. You are about to delete{" "}
          <span className="font-bold text-white">{scenario.attack_name}</span>.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-bold text-[#d4d4d4] transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[10px] bg-[#ff3434] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff4545]"
          >
            Delete Scenario
          </button>
        </div>
      </div>
    </div>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#a9a9a9] ${className}`}
    >
      {children}
    </th>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  title,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        danger
          ? "flex h-8 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-xs font-bold text-[#ff3434] transition hover:bg-[#ff3434]/10"
          : disabled
            ? "flex h-8 w-full cursor-not-allowed items-center gap-2.5 rounded-[8px] px-3 text-left text-xs font-bold text-[#727272] opacity-65"
            : "flex h-8 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-xs font-bold text-[#d4d4d4] transition hover:bg-[#4ad7ff]/10 hover:text-[#4ad7ff]"
      }
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-white/[0.07]" />;
}

function CompactSeverityBadge({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

  const className =
    normalized.includes("critical")
      ? "border-[#ff3434]/30 bg-[#ff3434]/10 text-[#ff3434]"
      : normalized.includes("high")
        ? "border-[#ffb347]/30 bg-[#ffb347]/10 text-[#ffb347]"
        : normalized.includes("medium")
          ? "border-[#ffd166]/30 bg-[#ffd166]/10 text-[#ffd166]"
          : "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]";

  return (
    <span
      className={`inline-flex min-w-[52px] justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black ${className}`}
    >
      {severity}
    </span>
  );
}

function CompactOwaspBadge({
  value,
  fullValue,
}: {
  value: string;
  fullValue: string;
}) {
  return (
    <span
      title={fullValue}
      className="inline-flex max-w-[96px] justify-center truncate rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-1.5 py-0.5 text-[10px] font-black text-[#4ad7ff]"
    >
      {value}
    </span>
  );
}

function ReviewStatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  const className =
    normalized.includes("approved") || normalized.includes("active")
      ? "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]"
      : normalized.includes("draft")
        ? "border-white/[0.08] bg-[#1f2122] text-[#a9a9a9]"
        : normalized.includes("review")
          ? "border-[#ffb347]/25 bg-[#ffb347]/10 text-[#ffb347]"
          : "border-[#4ad7ff]/25 bg-[#4ad7ff]/10 text-[#4ad7ff]";

  return (
    <span
      className={`inline-flex min-w-[60px] justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black ${className}`}
    >
      {value}
    </span>
  );
}

function buildScenarioTags(scenario: Scenario) {
  const rawTags = [
    ...scenario.tags,
    scenario.requires_rag ? "rag" : "",
    scenario.requires_tool ? "tool" : "",
    scenario.mutation_type || "",
    scenario.safe_for_demo ? "demo-safe" : "",
  ];

  return Array.from(
    new Set(
      rawTags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.replace(/\s+/g, "-"))
    )
  );
}

function buildTagPreview(tags: string[]) {
  if (tags.length === 0) return "";

  const priority = [
    "prompt-injection",
    "system-prompt",
    "rag",
    "retrieval",
    "tool",
    "direct",
    "jailbreak",
    "data-leakage",
    "misinformation",
  ];

  const sorted = [...tags].sort((a, b) => {
    const ai = priority.indexOf(a.toLowerCase());
    const bi = priority.indexOf(b.toLowerCase());

    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const visible = sorted.slice(0, 2);
  const hiddenCount = Math.max(tags.length - visible.length, 0);

  return hiddenCount > 0
    ? `${visible.join(" · ")} · +${hiddenCount}`
    : visible.join(" · ");
}

function getOwaspCode(value: string) {
  const match = value.match(/LLM\d{2}:\d{4}/i);

  if (match) {
    return match[0].toUpperCase();
  }

  return value.split(/[\s-]+/)[0] || value;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function EyeIcon() {
  return (
    <IconSvg>
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}

function PlayIcon() {
  return (
    <IconSvg>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </IconSvg>
  );
}

function PencilIcon() {
  return (
    <IconSvg>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}

function CopyIcon() {
  return (
    <IconSvg>
      <path
        d="M8 8h11v11H8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}

function ArchiveIcon() {
  return (
    <IconSvg>
      <path
        d="M4 7h16M5 7l1 13h12l1-13M8 4h8l1 3H7l1-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconSvg>
  );
}

function TrashIcon() {
  return (
    <IconSvg>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
