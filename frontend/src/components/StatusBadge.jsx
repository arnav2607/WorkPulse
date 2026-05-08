import React from "react";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  needs_rework: "bg-orange-100 text-orange-800 border-orange-200",
  closed: "bg-stone-200 text-stone-700 border-stone-300",
  missed: "bg-rose-100 text-rose-800 border-rose-200",
  on_leave: "bg-violet-100 text-violet-800 border-violet-200",
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  submitted: "bg-[#14532d] text-white border-[#14532d]",
  not_started: "bg-amber-100 text-amber-800 border-amber-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-stone-200 text-stone-700 border-stone-300",
  urgent: "bg-rose-100 text-rose-800 border-rose-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  casual: "bg-blue-100 text-blue-800 border-blue-200",
  sick: "bg-rose-100 text-rose-800 border-rose-200",
  half_day: "bg-amber-100 text-amber-800 border-amber-200",
  wfh: "bg-violet-100 text-violet-800 border-violet-200",
};

export default function StatusBadge({ status, className = "" }) {
  const key = (status || "").toLowerCase();
  const style = STATUS_STYLES[key] || "bg-stone-100 text-stone-700 border-stone-200";
  const label = (status || "—").replace(/_/g, " ");
  return (
    <span
      data-testid={`status-badge-${key}`}
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-full capitalize ${style} ${className}`}
    >
      {label}
    </span>
  );
}
