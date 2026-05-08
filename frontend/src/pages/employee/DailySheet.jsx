import React, { useEffect, useState, useMemo } from "react";
import { Lock, Save, Send } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { formatDate } from "@/utils/helpers";

const STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "not_done", label: "Not done" },
  { value: "not_required", label: "Not required" },
];

const SWATCHES = {
  done: "border-emerald-500 bg-emerald-50 text-emerald-800",
  not_done: "border-rose-500 bg-rose-50 text-rose-800",
  not_required: "border-stone-400 bg-stone-50 text-stone-700",
};

export default function DailySheet() {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState({}); // template_id -> {status, remarks}
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/sheets/today");
    setData(data.data);
    const map = {};
    (data.data.sheet?.entries || []).forEach((e) => { map[e.template_id] = { status: e.status, remarks: e.remarks || "" }; });
    setEntries(map);
  };

  useEffect(() => { load(); }, []);

  const locked = useMemo(() => {
    if (!data?.sheet) return false;
    return ["submitted", "missed", "on_leave"].includes(data.sheet.status);
  }, [data]);

  const updateEntry = (id, patch) => setEntries((prev) => ({ ...prev, [id]: { status: prev[id]?.status || null, remarks: prev[id]?.remarks || "", ...patch } }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = Object.entries(entries)
        .filter(([_, v]) => v.status)
        .map(([template_id, v]) => ({ template_id, status: v.status, remarks: v.remarks }));
      await api.post("/sheets/draft", { entries: payload });
      toast.success("Draft saved");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = Object.entries(entries)
        .filter(([_, v]) => v.status)
        .map(([template_id, v]) => ({ template_id, status: v.status, remarks: v.remarks }));
      await api.post("/sheets/submit", { entries: payload });
      toast.success("Sheet submitted — locked for the day.");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="p-10 text-center text-stone-500">Loading…</div>;
  const { sheet, template } = data;

  return (
    <div data-testid="daily-sheet" className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Today · {formatDate(sheet.date)}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Daily activity sheet</h1>
          <p className="text-sm text-stone-600 mt-1">Mark each item, save as draft and submit before logging out.</p>
        </div>
        <StatusBadge status={sheet.status} />
      </div>

      {locked && (
        <div data-testid="locked-banner" className="flex items-center gap-2 p-4 rounded-xl bg-[#fef8f0] border border-[#e5e3db] text-sm text-stone-700">
          <Lock className="w-4 h-4" /> This sheet is {sheet.status}. No further edits are allowed.
        </div>
      )}

      <div className="space-y-3">
        {template.map((t) => {
          const cur = entries[t.id] || {};
          return (
            <div key={t.id} data-testid={`entry-${t.id}`} className="bg-white border border-[#e5e3db] rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-medium">{t.name}</h3>
                  {t.description && <p className="text-sm text-stone-500 mt-0.5">{t.description}</p>}
                </div>
                {t.is_required && <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full bg-[#14532d] text-white">Required</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const selected = cur.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      data-testid={`entry-${t.id}-${opt.value}`}
                      disabled={locked}
                      onClick={() => updateEntry(t.id, { status: opt.value })}
                      className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
                        selected
                          ? `${SWATCHES[opt.value]} font-medium`
                          : "bg-white border-[#e5e3db] text-stone-600 hover:bg-stone-50"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <Textarea
                data-testid={`entry-${t.id}-remark`}
                rows={2}
                placeholder="Optional remarks…"
                disabled={locked}
                value={cur.remarks || ""}
                onChange={(e) => updateEntry(t.id, { remarks: e.target.value })}
                className="mt-3 bg-stone-50 border-[#e5e3db]"
              />
            </div>
          );
        })}
        {template.length === 0 && <p className="text-stone-500 text-center py-10">No template items configured by the admin yet.</p>}
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-2 sticky bottom-4">
          <Button onClick={save} disabled={busy} variant="outline" className="rounded-xl" data-testid="save-draft-btn">
            <Save className="w-4 h-4 mr-1" /> Save draft
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-[#14532d] hover:bg-[#166534] rounded-xl" data-testid="submit-sheet-btn">
            <Send className="w-4 h-4 mr-1" /> Submit & lock
          </Button>
        </div>
      )}
    </div>
  );
}
