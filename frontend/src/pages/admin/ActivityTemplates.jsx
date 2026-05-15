import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ActivityTemplates() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", is_required: true, frequency: "daily", frequency_value: "" });

  const load = async () => {
    const { data } = await api.get("/activities/template/all");
    setItems(data.data || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm({ name: "", description: "", is_required: true, frequency: "daily", frequency_value: "" }); setOpen(true); };
  const startEdit = (it) => {
    setEditing(it);
    setForm({ name: it.name, description: it.description || "", is_required: it.is_required, frequency: it.frequency || "daily", frequency_value: it.frequency_value || "" });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await api.patch(`/activities/template/${editing.id}`, form);
      else await api.post("/activities/template", form);
      toast.success("Saved");
      setOpen(false); load();
    } catch (e) { toast.error("Failed"); }
  };

  const toggleActive = async (it) => {
    if (it.is_active) {
      await api.delete(`/activities/template/${it.id}`);
    } else {
      await api.patch(`/activities/template/${it.id}`, { is_active: true });
    }
    load();
  };

  return (
    <div data-testid="admin-templates" className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Daily Activity Sheet</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Template designer</h1>
          <p className="text-sm text-stone-600 mt-1">These items appear on every employee's daily sheet. Read-only for them.</p>
        </div>
        <Button onClick={startNew} data-testid="new-template-btn" className="bg-[#14532d] hover:bg-[#166534] rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Add item
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((it) => (
          <div
            key={it.id}
            data-testid={`tpl-${it.id}`}
            className={`p-5 rounded-xl border ${it.is_active ? "bg-white border-[#e5e3db]" : "bg-stone-50 border-stone-200 opacity-70"}`}
          >
            <div className="flex justify-between items-start gap-3 mb-2">
              <h3 className="font-display font-medium">{it.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => startEdit(it)} className="p-1.5 rounded-md hover:bg-stone-100" data-testid={`edit-tpl-${it.id}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => toggleActive(it)} className="p-1.5 rounded-md hover:bg-stone-100" data-testid={`toggle-tpl-${it.id}`}>
                  {it.is_active ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                </button>
              </div>
            </div>
            {it.description && <p className="text-sm text-stone-600 leading-relaxed">{it.description}</p>}
            <div className="flex gap-2 mt-3">
              {it.is_required && (<span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full bg-[#14532d] text-white">Required</span>)}
              {!it.is_active && (<span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full bg-stone-200 text-stone-600">Inactive</span>)}
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full bg-stone-200 text-stone-700">{it.frequency || "daily"} {it.frequency_value && `(${it.frequency_value})`}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-2 text-center text-stone-500 py-10">No template items.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl" data-testid="template-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit item" : "New activity item"}</DialogTitle>
            <DialogDescription>This will appear on every employee's daily sheet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input data-testid="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea data-testid="tpl-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#14532d]"
                  value={form.frequency} 
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              {form.frequency !== "daily" && (
                <div>
                  <Label>Frequency Value</Label>
                  {form.frequency === "weekly" && (
                    <select
                      className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#14532d]"
                      value={form.frequency_value}
                      onChange={(e) => setForm({ ...form, frequency_value: e.target.value })}
                    >
                      <option value="">Select day</option>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                  {form.frequency === "monthly" && (
                    <select
                      className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#14532d]"
                      value={form.frequency_value}
                      onChange={(e) => setForm({ ...form, frequency_value: e.target.value })}
                    >
                      <option value="">Select date</option>
                      {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                  {form.frequency === "annually" && (
                    <div className="flex gap-2">
                      <select
                        className="flex h-10 w-1/2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#14532d]"
                        value={form.frequency_value.split("-")[0] || ""}
                        onChange={(e) => {
                          const parts = form.frequency_value.split("-");
                          const day = parts[1] || "01";
                          setForm({ ...form, frequency_value: `${e.target.value}-${day}` });
                        }}
                      >
                        <option value="">Month</option>
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        className="flex h-10 w-1/2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#14532d]"
                        value={form.frequency_value.split("-")[1] || ""}
                        onChange={(e) => {
                          const parts = form.frequency_value.split("-");
                          const month = parts[0] || "01";
                          setForm({ ...form, frequency_value: `${month}-${e.target.value}` });
                        }}
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

            </div>
            <div className="flex items-center justify-between border border-[#e5e3db] rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Required</p>
                <p className="text-xs text-stone-500">Employees must select an option for this item</p>
              </div>
              <Switch data-testid="tpl-required" checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#14532d] hover:bg-[#166534]" data-testid="save-tpl-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
