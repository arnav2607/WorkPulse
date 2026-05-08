import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/utils/helpers";

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const nav = useNavigate();

  const load = async () => {
    const params = {};
    if (filter !== "all") params.status = filter;
    const { data } = await api.get("/tasks", { params });
    setTasks(data.data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div data-testid="my-tasks" className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Workflow</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">My tasks</h1>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-44 bg-white border-[#e5e3db]" data-testid="my-task-filter"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {["pending", "in_progress", "done", "blocked", "approved", "needs_rework", "closed"].map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30 text-left">
            <tr>
              {["Title", "Priority", "Status", "Deadline"].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {tasks.map((t) => (
              <tr
                key={t.id}
                data-testid={`my-task-${t.id}`}
                onClick={() => nav(`/employee/tasks/${t.id}`)}
                className="cursor-pointer hover:bg-[#fef8f0]/40 transition-colors"
              >
                <td className="px-5 py-3 font-medium">{t.title}</td>
                <td className="px-5 py-3"><StatusBadge status={t.priority} /></td>
                <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 text-stone-600">{formatDate(t.deadline)}</td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-stone-500">No tasks.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
