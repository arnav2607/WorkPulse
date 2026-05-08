import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { formatDate } from "@/utils/helpers";

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState("all");
  const [decision, setDecision] = useState(null); // {leave, action}
  const [comment, setComment] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const load = async () => {
    const params = {};
    if (filter !== "all") params.status = filter;
    const { data } = await api.get("/leaves", { params });
    setLeaves(data.data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const submit = async () => {
    const path = decision.action === "approve" ? "approve" : "reject";
    try {
      await api.patch(`/leaves/${decision.leave.id}/${path}`, { admin_comment: comment });
      toast.success(`Leave ${decision.action}d`);
      setDecision(null); setComment(""); load();
    } catch (e) { toast.error("Failed"); }
  };

  // Calendar
  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startWeekday = first.getDay();
    const days = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));
    return days;
  }, [month]);

  const approvedLeaves = leaves.filter((l) => l.status === "approved");
  const leavesOnDate = (date) => {
    const iso = date.toISOString().slice(0, 10);
    return approvedLeaves.filter((l) => l.from_date <= iso && l.to_date >= iso);
  };

  return (
    <div data-testid="admin-leaves" className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Time off</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leaves</h1>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-medium">Monthly calendar</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 rounded-md hover:bg-[#f5e8d3]/60"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-medium text-sm w-32 text-center">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 rounded-md hover:bg-[#f5e8d3]/60"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-stone-500 uppercase tracking-wider text-center pb-2">{d}</div>
          ))}
          {calendarDays.map((d, i) => {
            if (!d) return <div key={i} />;
            const ls = leavesOnDate(d);
            return (
              <div key={i} className={`min-h-[68px] rounded-md border border-[#e5e3db] p-1.5 ${ls.length ? "bg-violet-50" : "bg-white"}`}>
                <p className="text-xs font-medium">{d.getDate()}</p>
                <div className="space-y-0.5 mt-1">
                  {ls.slice(0, 2).map((l) => (
                    <p key={l.id} className="truncate text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-800">{l.employee_name}</p>
                  ))}
                  {ls.length > 2 && <p className="text-[10px] text-violet-600">+{ls.length - 2} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-white border-[#e5e3db]" data-testid="leave-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30 text-left">
            <tr>
              {["Employee", "Type", "From", "To", "Reason", "Status", ""].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {leaves.map((l) => (
              <tr key={l.id} data-testid={`leave-row-${l.id}`}>
                <td className="px-5 py-3 font-medium">{l.employee_name}</td>
                <td className="px-5 py-3"><StatusBadge status={l.leave_type} /></td>
                <td className="px-5 py-3 text-stone-600">{formatDate(l.from_date)}</td>
                <td className="px-5 py-3 text-stone-600">{formatDate(l.to_date)}</td>
                <td className="px-5 py-3 text-stone-600 max-w-xs truncate">{l.reason}</td>
                <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-5 py-3 text-right">
                  {l.status === "pending" && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" data-testid={`approve-${l.id}`} onClick={() => setDecision({ leave: l, action: "approve" })}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`reject-${l.id}`} onClick={() => setDecision({ leave: l, action: "reject" })}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-stone-500">No leave requests.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!decision} onOpenChange={(v) => !v && setDecision(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display capitalize">{decision?.action} leave</DialogTitle>
          </DialogHeader>
          <Label>Comment (optional)</Label>
          <Textarea data-testid="decision-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button data-testid="confirm-decision-btn" onClick={submit} className="bg-[#14532d] hover:bg-[#166534]">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
