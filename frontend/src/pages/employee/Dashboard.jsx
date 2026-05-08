import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileEdit, ListChecks, Calendar, Plane, ArrowRight } from "lucide-react";
import { api } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTime } from "@/utils/helpers";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/dashboard/employee").then((r) => setData(r.data.data));
  }, []);

  if (!data) return <div className="p-10 text-center text-stone-500">Loading…</div>;
  const { today_sheet_status, pending_tasks, pending_count, upcoming_deadlines, leave_balance, recent_remarks } = data;
  const sheetSubmitted = today_sheet_status === "submitted" || today_sheet_status === "on_leave";

  return (
    <div data-testid="employee-dashboard" className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Hello</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-stone-600 mt-1">Here's what needs your focus today.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          data-testid="today-sheet-card"
          className={`lg:col-span-2 p-6 rounded-2xl border ${
            sheetSubmitted
              ? "bg-[#14532d] text-white border-[#14532d]"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] uppercase tracking-[0.2em] mb-1 ${sheetSubmitted ? "text-white/70" : "text-amber-700"}`}>Today's activity sheet</p>
              <h2 className="font-display text-2xl font-medium">
                {today_sheet_status === "submitted" && "Submitted — nice work."}
                {today_sheet_status === "on_leave" && "You're on approved leave today."}
                {(today_sheet_status === "draft" || today_sheet_status === "not_started") && "Not submitted yet"}
                {today_sheet_status === "missed" && "Marked as missed"}
              </h2>
              <p className={`text-sm mt-1 ${sheetSubmitted ? "text-white/80" : "text-amber-800"}`}>
                {sheetSubmitted ? "Take a moment to review your tasks." : "Submit it before logging out today."}
              </p>
            </div>
            <button
              onClick={() => nav("/employee/sheet")}
              data-testid="goto-sheet-cta"
              className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1 ${
                sheetSubmitted ? "bg-white text-[#14532d] hover:bg-stone-100" : "bg-[#14532d] text-white hover:bg-[#166534]"
              }`}
            >
              <FileEdit className="w-4 h-4" /> {sheetSubmitted ? "Review" : "Fill now"}
            </button>
          </div>
        </div>

        <div data-testid="leave-balance-card" className="p-6 rounded-2xl bg-white border border-[#e5e3db]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Leave balance · {new Date().getFullYear()}</p>
          <div className="space-y-3">
            {[
              { label: "Casual", used: leave_balance.casual_used, total: leave_balance.casual_total, color: "bg-blue-500" },
              { label: "Sick", used: leave_balance.sick_used, total: leave_balance.sick_total, color: "bg-rose-500" },
            ].map((b) => {
              const remaining = Math.max(b.total - b.used, 0);
              const pct = b.total ? Math.min(100, (b.used / b.total) * 100) : 0;
              return (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{b.label}</span>
                    <span className="font-display font-medium"><span className="text-[#14532d]">{remaining}</span> / {b.total}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={b.color + " h-full transition-all"} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-testid="pending-tasks-card" className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[#e5e3db]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-medium">Pending tasks ({pending_count})</h3>
            <button onClick={() => nav("/employee/tasks")} className="text-sm text-[#14532d] hover:underline inline-flex items-center gap-1">
              All tasks <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {pending_tasks.length === 0 ? (
            <p className="text-sm text-stone-500 py-6">Nothing pending. Good for you.</p>
          ) : (
            <ul className="divide-y divide-[#e5e3db]">
              {pending_tasks.slice(0, 6).map((t) => (
                <li
                  key={t.id}
                  onClick={() => nav(`/employee/tasks/${t.id}`)}
                  data-testid={`pending-task-${t.id}`}
                  className="py-3 flex items-center gap-3 cursor-pointer hover:bg-[#fef8f0]/40 px-2 -mx-2 rounded"
                >
                  <ListChecks className="w-4 h-4 text-stone-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-stone-500">Due {formatDate(t.deadline)}</p>
                  </div>
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div data-testid="upcoming-deadlines-card" className="p-6 rounded-2xl bg-white border border-[#e5e3db]">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-stone-500" />
            <h3 className="font-display text-lg font-medium">Upcoming · 7 days</h3>
          </div>
          {upcoming_deadlines.length === 0 ? (
            <p className="text-sm text-stone-500 py-3">No imminent deadlines.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming_deadlines.slice(0, 6).map((t) => (
                <li key={t.id} className="text-sm border-l-2 border-[#fdba74] pl-3 py-1">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-stone-500">{formatDate(t.deadline)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div data-testid="recent-remarks-card" className="p-6 rounded-2xl bg-white border border-[#e5e3db]">
        <h3 className="font-display text-lg font-medium mb-4">Recent admin remarks</h3>
        {recent_remarks.length === 0 ? (
          <p className="text-sm text-stone-500 py-3">No remarks yet.</p>
        ) : (
          <ul className="space-y-3">
            {recent_remarks.map((r) => (
              <li key={r.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#fef8f0] border border-[#e5e3db] flex items-center justify-center text-xs font-semibold shrink-0">
                  {(r.author_name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-500"><span className="font-medium text-stone-800">{r.author_name}</span> · {r.task_title} · {formatDateTime(r.created_at)}</p>
                  <p className="text-sm text-stone-700 mt-0.5">{r.remark}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
