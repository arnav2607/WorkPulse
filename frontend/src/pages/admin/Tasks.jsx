import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { formatDate } from "@/utils/helpers";

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "all", employee_id: "all", priority: "all" });
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", priority: "medium", deadline: "" });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    const params = {};
    if (filters.status !== "all") params.status = filters.status;
    if (filters.employee_id !== "all") params.employee_id = filters.employee_id;
    if (filters.priority !== "all") params.priority = filters.priority;
    const { data } = await api.get("/tasks", { params });
    setTasks(data.data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  useEffect(() => {
    api.get("/employees", { params: { is_active: true, role: "employee" } })
      .then((r) => setEmployees(r.data.data || []));
  }, []);

  const create = async () => {
    if (!form.title || !form.assigned_to) {
      toast.error("Title and assignee are required");
      return;
    }
    setBusy(true);
    try {
      await api.post("/tasks", { ...form, deadline: form.deadline || null });
      toast.success("Task created");
      setOpen(false);
      setForm({ title: "", description: "", assigned_to: "", priority: "medium", deadline: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="admin-tasks" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Workflow</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="new-task-btn" className="bg-[#14532d] hover:bg-[#166534] rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> New task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-44 bg-white border-[#e5e3db]" data-testid="filter-status">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {["pending", "in_progress", "done", "blocked", "approved", "needs_rework", "closed"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.employee_id} onValueChange={(v) => setFilters({ ...filters, employee_id: v })}>
          <SelectTrigger className="w-56 bg-white border-[#e5e3db]" data-testid="filter-employee">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(v) => setFilters({ ...filters, priority: v })}>
          <SelectTrigger className="w-40 bg-white border-[#e5e3db]" data-testid="filter-priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["low", "medium", "high", "urgent"].map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Title</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Assignee</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Priority</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {tasks.map((t) => (
              <tr
                key={t.id}
                data-testid={`task-row-${t.id}`}
                onClick={() => nav(`/admin/tasks/${t.id}`)}
                className="cursor-pointer hover:bg-[#fef8f0]/40 transition-colors"
              >
                <td className="px-5 py-3 font-medium">{t.title}</td>
                <td className="px-5 py-3 text-stone-600">{t.assigned_to_name}</td>
                <td className="px-5 py-3"><StatusBadge status={t.priority} /></td>
                <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 text-stone-600">{formatDate(t.deadline)}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-stone-500">No tasks yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl" data-testid="task-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">New task</DialogTitle>
            <DialogDescription>Assign clearly. Add context that helps your team move fast.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input data-testid="task-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea data-testid="task-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assignee</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger data-testid="task-assignee-select"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "urgent"].map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                data-testid="task-deadline-input"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy} className="bg-[#14532d] hover:bg-[#166534]" data-testid="create-task-btn">
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
