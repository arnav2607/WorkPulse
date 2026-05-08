import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ListTodo, AlertTriangle, FileSpreadsheet, Plane, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "@/api/client";
import { formatDateTime } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";

const CHART_COLORS = ["#14532d", "#22c55e", "#fdba74", "#d4a574", "#86efac", "#f97316", "#3b82f6", "#8b5cf6"];

function MetricCard({ icon: Icon, label, value, accent, testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-white border border-[#e5e3db] rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-400" />
      </div>
      <div className="text-3xl font-display font-semibold tracking-tight">{value ?? 0}</div>
      <div className="text-xs uppercase tracking-wider text-stone-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/dashboard/admin").then((r) => setData(r.data.data)).catch(() => {});
  }, []);

  const m = data?.metrics || {};
  return (
    <div data-testid="admin-dashboard" className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Overview</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Operations Console</h1>
          <p className="text-sm text-stone-600 mt-1">Live snapshot of today's operations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => nav("/admin/tasks")}
            data-testid="quick-assign-task-btn"
            className="px-4 py-2 rounded-xl bg-[#14532d] hover:bg-[#166534] text-white text-sm font-medium"
          >
            Assign task
          </button>
          <button
            onClick={() => nav("/admin/leaves")}
            data-testid="quick-view-leaves-btn"
            className="px-4 py-2 rounded-xl border border-[#e5e3db] bg-white hover:bg-[#f5e8d3]/50 text-sm font-medium"
          >
            Pending leaves
          </button>
          <button
            onClick={() => nav("/admin/sheets")}
            data-testid="quick-view-sheets-btn"
            className="px-4 py-2 rounded-xl border border-[#e5e3db] bg-white hover:bg-[#f5e8d3]/50 text-sm font-medium"
          >
            Missed sheets
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard testid="metric-employees" icon={Users} label="Employees" value={m.total_employees} accent="bg-emerald-100 text-emerald-700" />
        <MetricCard testid="metric-pending-tasks" icon={ListTodo} label="Pending tasks" value={m.pending_tasks} accent="bg-amber-100 text-amber-700" />
        <MetricCard testid="metric-overdue-tasks" icon={AlertTriangle} label="Overdue" value={m.overdue_tasks} accent="bg-rose-100 text-rose-700" />
        <MetricCard testid="metric-sheets-today" icon={FileSpreadsheet} label="Sheets today" value={m.sheets_today} accent="bg-blue-100 text-blue-700" />
        <MetricCard testid="metric-on-leave" icon={Plane} label="On leave" value={m.on_leave_today} accent="bg-violet-100 text-violet-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#e5e3db] rounded-xl p-6">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <h3 className="font-display text-lg font-medium">Weekly task completion</h3>
              <p className="text-xs text-stone-500">Last 7 days · per employee</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.weekly_completion || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e3db" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e3db" }} />
                <Bar dataKey="completed" fill="#14532d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#e5e3db] rounded-xl p-6">
          <h3 className="font-display text-lg font-medium mb-1">Task status</h3>
          <p className="text-xs text-stone-500 mb-4">Distribution</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.status_distribution || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  innerRadius={48}
                  paddingAngle={3}
                >
                  {(data?.status_distribution || []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e3db" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl p-6">
        <h3 className="font-display text-lg font-medium">Sheet submission rate</h3>
        <p className="text-xs text-stone-500 mb-4">% of employees who submitted, last 30 days</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.submission_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e3db" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} />
              <YAxis tick={{ fontSize: 11, fill: "#78716c" }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e3db" }} />
              <Line type="monotone" dataKey="rate" stroke="#14532d" strokeWidth={2.5} dot={{ r: 3, fill: "#fdba74" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl p-6">
        <h3 className="font-display text-lg font-medium mb-4">Recent activity</h3>
        {(!data?.recent_activity || data.recent_activity.length === 0) ? (
          <p className="text-sm text-stone-500 py-6">No recent updates yet.</p>
        ) : (
          <ul className="divide-y divide-[#e5e3db]">
            {data.recent_activity.map((r) => (
              <li key={r.id} className="py-3 flex items-start gap-3" data-testid={`activity-${r.id}`}>
                <div className="w-8 h-8 rounded-full bg-[#fef8f0] border border-[#e5e3db] flex items-center justify-center text-xs font-semibold text-stone-700">
                  {(r.author_name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 leading-snug truncate">
                    <span className="font-medium">{r.author_name}</span> · {r.remark}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">{formatDateTime(r.created_at)}</p>
                </div>
                <StatusBadge status={r.author_role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
