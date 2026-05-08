import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, todayISO } from "@/utils/helpers";

export default function EmployeeLeaves() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [balance, setBalance] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", from_date: todayISO(), to_date: todayISO(), reason: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/leaves"),
      api.get(`/leaves/balance/${user.id}`),
    ]);
    setList(a.data.data || []);
    setBalance(b.data.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const apply = async () => {
    if (!form.reason.trim()) { toast.error("Reason is required"); return; }
    setBusy(true);
    try {
      await api.post("/leaves", form);
      toast.success("Leave request submitted");
      setOpen(false);
      setForm({ leave_type: "casual", from_date: todayISO(), to_date: todayISO(), reason: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const cancel = async (id) => {
    await api.delete(`/leaves/${id}`);
    toast.success("Leave cancelled");
    load();
  };

  return (
    <div data-testid="emp-leaves" className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Time off</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Leaves</h1>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="apply-leave-btn" className="bg-[#14532d] hover:bg-[#166534] rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Apply
        </Button>
      </div>

      {balance && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Casual", used: balance.casual_used, total: balance.casual_total, color: "from-blue-500 to-sky-400" },
            { label: "Sick", used: balance.sick_used, total: balance.sick_total, color: "from-rose-500 to-pink-400" },
          ].map((b) => (
            <div key={b.label} className="p-5 rounded-xl bg-white border border-[#e5e3db]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">{b.label} leave · {new Date().getFullYear()}</p>
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-semibold text-[#14532d]">{Math.max(b.total - b.used, 0)}</span>
                <span className="text-stone-500 text-sm pb-1">/ {b.total} remaining</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full mt-3 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${b.color}`} style={{ width: `${b.total ? Math.min(100, (b.used / b.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30 text-left">
            <tr>
              {["Type", "From", "To", "Reason", "Status", ""].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {list.map((l) => (
              <tr key={l.id} data-testid={`my-leave-${l.id}`}>
                <td className="px-5 py-3"><StatusBadge status={l.leave_type} /></td>
                <td className="px-5 py-3 text-stone-600">{formatDate(l.from_date)}</td>
                <td className="px-5 py-3 text-stone-600">{formatDate(l.to_date)}</td>
                <td className="px-5 py-3 text-stone-600 max-w-xs truncate">{l.reason}</td>
                <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-5 py-3 text-right">
                  {l.status === "pending" && (
                    <button
                      onClick={() => cancel(l.id)}
                      data-testid={`cancel-leave-${l.id}`}
                      className="px-2.5 py-1.5 rounded-md text-xs hover:bg-rose-50 text-rose-700 inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-stone-500">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Apply for leave</DialogTitle>
            <DialogDescription>Add a clear reason — it helps your admin decide faster.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["casual", "sick", "half_day", "wfh"].map((t) => (<SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input data-testid="leave-from" type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
              <div><Label>To</Label><Input data-testid="leave-to" type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea data-testid="leave-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={apply} disabled={busy} className="bg-[#14532d] hover:bg-[#166534]" data-testid="submit-leave-btn">
              {busy ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
