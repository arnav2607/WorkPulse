import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/utils/helpers";

export default function EmployeeTaskDetail() {
  const { taskId } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("pending");

  const load = async () => {
    const { data } = await api.get(`/tasks/${taskId}`);
    setData(data.data);
    setStatus(data.data.task.status);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const updateStatus = async () => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      toast.success("Status updated");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const addRemark = async () => {
    if (!remark.trim()) return;
    try {
      await api.post(`/tasks/${taskId}/remarks`, { remark });
      setRemark("");
      load();
      toast.success("Remark added");
    } catch (e) { toast.error("Failed"); }
  };

  if (!data) return <div className="p-10 text-center text-stone-500">Loading…</div>;
  const { task, remarks } = data;
  const editable = !["closed", "approved"].includes(task.status);

  return (
    <div data-testid="emp-task-detail" className="space-y-6 max-w-4xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white border border-[#e5e3db] rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Task</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{task.title}</h1>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={task.status} />
            <StatusBadge status={task.priority} />
          </div>
        </div>
        <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{task.description || "No description."}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#e5e3db] text-sm">
          <div><p className="text-[11px] uppercase tracking-wider text-stone-500">Created by</p><p className="font-medium mt-0.5">{task.created_by_name}</p></div>
          <div><p className="text-[11px] uppercase tracking-wider text-stone-500">Deadline</p><p className="font-medium mt-0.5">{formatDate(task.deadline)}</p></div>
        </div>
      </div>

      {editable && (
        <div className="bg-white border border-[#e5e3db] rounded-2xl p-6">
          <h3 className="font-display text-lg font-medium mb-3">Update progress</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44" data-testid="emp-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "in_progress", "done", "blocked"].map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={updateStatus} className="bg-[#14532d] hover:bg-[#166534]" data-testid="emp-update-status-btn">Update</Button>
          </div>

          <div className="mt-5">
            <Label className="text-xs">Add a progress remark</Label>
            <Textarea data-testid="emp-remark-input" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Share progress, blockers or context…" />
            <Button onClick={addRemark} disabled={!remark.trim()} variant="outline" className="mt-3" data-testid="emp-add-remark-btn">
              Post remark
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e5e3db] rounded-2xl p-6">
        <h3 className="font-display text-lg font-medium mb-4">Activity timeline</h3>
        {remarks.length === 0 ? (
          <p className="text-sm text-stone-500 py-4">No remarks yet.</p>
        ) : (
          <ul className="space-y-3">
            {remarks.map((r) => (
              <li key={r.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#fef8f0] border border-[#e5e3db] flex items-center justify-center text-xs font-semibold shrink-0">
                  {(r.author_name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="font-medium text-stone-800">{r.author_name}</span>
                    <StatusBadge status={r.author_role} />
                    <span>·</span>
                    <span>{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-stone-700 mt-1 whitespace-pre-wrap">{r.remark}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
