import React, { useEffect, useState } from "react";
import { Plus, Pencil, UserX, UserCheck, X } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { formatDate } from "@/utils/helpers";

const empty = { name: "", email: "", password: "", department: "", role: "employee" };

export default function Employees() {
  const [list, setList] = useState([]);
  const [filterActive, setFilterActive] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const params = {};
    if (filterActive === "active") params.is_active = true;
    if (filterActive === "inactive") params.is_active = false;
    const { data } = await api.get("/employees", { params });
    setList(data.data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterActive]);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", department: u.department || "", role: u.role });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await api.patch(`/employees/${editing.id}`, body);
        toast.success("Employee updated");
      } else {
        await api.post("/employees", form);
        toast.success("Employee created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  const toggle = async (u) => {
    if (u.is_active) {
      await api.delete(`/employees/${u.id}`);
      toast.success("Employee deactivated");
    } else {
      await api.patch(`/employees/${u.id}`, { is_active: true });
      toast.success("Employee reactivated");
    }
    load();
  };

  return (
    <div data-testid="admin-employees" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Team</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Employees</h1>
        </div>
        <Button
          onClick={startNew}
          data-testid="new-employee-btn"
          className="bg-[#14532d] hover:bg-[#166534] rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1" /> New employee
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-44 bg-white border-[#e5e3db]" data-testid="filter-active">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Department</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Joined</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {list.map((u) => (
              <tr key={u.id} data-testid={`emp-row-${u.id}`} className="hover:bg-[#fef8f0]/40 transition-colors">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-stone-600">{u.email}</td>
                <td className="px-5 py-3 text-stone-600">{u.department || "—"}</td>
                <td className="px-5 py-3"><StatusBadge status={u.role} /></td>
                <td className="px-5 py-3"><StatusBadge status={u.is_active ? "approved" : "closed"} /></td>
                <td className="px-5 py-3 text-stone-600">{formatDate(u.created_at)}</td>
                <td className="px-5 py-3 flex justify-end gap-1">
                  <button
                    onClick={() => startEdit(u)}
                    data-testid={`edit-emp-${u.id}`}
                    className="p-1.5 rounded-md hover:bg-[#f5e8d3]/60"
                  >
                    <Pencil className="w-4 h-4 text-stone-600" />
                  </button>
                  <button
                    onClick={() => toggle(u)}
                    data-testid={`toggle-emp-${u.id}`}
                    className="p-1.5 rounded-md hover:bg-[#f5e8d3]/60"
                  >
                    {u.is_active ? <UserX className="w-4 h-4 text-rose-600" /> : <UserCheck className="w-4 h-4 text-emerald-600" />}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-stone-500">No employees yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl" data-testid="employee-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit employee" : "New employee"}</DialogTitle>
            <DialogDescription>Fill the details below to {editing ? "update" : "create"} the team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input data-testid="form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input data-testid="form-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{editing ? "New password (leave blank to keep)" : "Password"}</Label>
              <Input data-testid="form-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Input data-testid="form-department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="form-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="bg-[#14532d] hover:bg-[#166534]" data-testid="save-emp-btn">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
