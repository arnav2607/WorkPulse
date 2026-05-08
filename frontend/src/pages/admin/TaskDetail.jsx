import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MessageSquarePlus } from "lucide-react";
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

export default function TaskDetailAdmin() {
  const { taskId } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [remark, setRemark] = useState("");
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/tasks/${taskId}`);
    setData(data.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const addRemark = async () => {
    if (!remark.trim()) return;
    setBusy(true);
    try {
      await api.post(`/tasks/${taskId}/remarks`, { remark });
      setRemark("");
      load();
      toast.success("Remark added");
    } finally { setBusy(false); }
  };

  const review = async () => {
    setBusy(true);
    try {
      await api.patch(`/tasks/${taskId}/review`, { status: reviewStatus, remark: remark || null });
      setRemark("");
      load();
      toast.success("Task reviewed");
    } finally { setBusy(false); }
  };

  if (!data) return <div className="p-10 text-center text-stone-500">Loading…</div>;
  const { task, remarks } = data;

  return (
    <div data-testid="task-detail" className="space-y-6 max-w-4xl">
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
          <div><p className="text-[11px] uppercase tracking-wider text-stone-500">Assignee</p><p className="font-medium mt-0.5">{task.assigned_to_name}</p></div>
          <div><p className="text-[11px] uppercase tracking-wider text-stone-500">Created by</p><p className="font-medium mt-0.5">{task.created_by_name}</p></div>
          <div><p className="text-[11px] uppercase tracking-wider text-stone-500">Deadline</p><p className="font-medium mt-0.5">{formatDate(task.deadline)}</p></div>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-2xl p-6">
        <h3 className="font-display text-lg font-medium mb-4">Review & remarks</h3>
        <Textarea
          rows={3}
          placeholder="Add a remark or review note…"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          data-testid="remark-input"
        />
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <Button onClick={addRemark} disabled={busy || !remark.trim()} variant="outline" data-testid="add-remark-btn">
            <MessageSquarePlus className="w-4 h-4 mr-1" /> Add remark
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs">Mark as</Label>
            <Select value={reviewStatus} onValueChange={setReviewStatus}>
              <SelectTrigger className="w-44" data-testid="review-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="needs_rework">Needs rework</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={review} disabled={busy} className="bg-[#14532d] hover:bg-[#166534]" data-testid="review-task-btn">
              Submit review
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-2xl p-6">
        <h3 className="font-display text-lg font-medium mb-4">Activity timeline</h3>
        {remarks.length === 0 ? (
          <p className="text-sm text-stone-500 py-4">No remarks yet.</p>
        ) : (
          <ul className="space-y-3">
            {remarks.map((r) => (
              <li key={r.id} className="flex gap-3" data-testid={`remark-${r.id}`}>
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
