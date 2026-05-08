import React, { useEffect, useState } from "react";
import { ListChecks, RotateCcw } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ManageActivitiesDialog({ employee, open, onOpenChange, onSaved }) {
  const [allTpl, setAllTpl] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isAll, setIsAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/employees/${employee.id}/activities`);
        const d = data.data;
        setAllTpl(d.all_templates || []);
        setSelected(new Set(d.assigned_ids || []));
        setIsAll(d.is_all);
      } catch (e) { toast.error("Failed to load activities"); }
      finally { setLoading(false); }
    };
    load();
  }, [open, employee]);

  const toggle = (id) => {
    setIsAll(false);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    setIsAll(true);
    setSelected(new Set(allTpl.map((t) => t.id)));
  };

  const selectNone = () => {
    setIsAll(false);
    setSelected(new Set());
  };

  const save = async () => {
    setBusy(true);
    try {
      // If "all", send null so future template additions auto-include this employee
      const body = isAll ? { template_ids: null } : { template_ids: Array.from(selected) };
      await api.put(`/employees/${employee.id}/activities`, body);
      toast.success(`Activities updated for ${employee.name}`);
      onOpenChange(false);
      onSaved?.();
    } catch (e) { toast.error("Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg" data-testid="manage-activities-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-[#14532d]" /> Activities for {employee?.name}
          </DialogTitle>
          <DialogDescription>
            Pick which activities appear in this employee's daily sheet. Unchecked ones won't be required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 -mt-1">
          <button
            type="button"
            onClick={selectAll}
            data-testid="ma-select-all"
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isAll
                ? "bg-[#14532d] text-white border-[#14532d]"
                : "bg-white text-stone-700 border-[#e5e3db] hover:bg-[#f5e8d3]/50"
            }`}
          >
            <RotateCcw className="w-3 h-3 inline mr-1" /> All (auto-includes new ones)
          </button>
          <button
            type="button"
            onClick={selectNone}
            data-testid="ma-select-none"
            className="text-xs px-3 py-1.5 rounded-full border bg-white text-stone-700 border-[#e5e3db] hover:bg-[#f5e8d3]/50"
          >
            Clear all
          </button>
          <span className="text-xs text-stone-500 ml-auto">
            {isAll ? "All activities" : `${selected.size} selected`}
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 mt-2 pr-1">
          {loading && <p className="text-sm text-stone-500 text-center py-6">Loading…</p>}
          {!loading && allTpl.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-6">
              No activity templates created yet. Create some first under Activity Template.
            </p>
          )}
          {allTpl.map((t) => {
            const checked = selected.has(t.id);
            return (
              <label
                key={t.id}
                data-testid={`ma-item-${t.id}`}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? "bg-[#14532d]/5 border-[#14532d]/30"
                    : "bg-white border-[#e5e3db] hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t.id)}
                  className="mt-1 accent-[#14532d]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    {t.is_required && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#14532d] text-white">
                        Required
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-stone-500 mt-0.5">{t.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            data-testid="ma-save-btn"
            onClick={save}
            disabled={busy || loading}
            className="bg-[#14532d] hover:bg-[#166534]"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
