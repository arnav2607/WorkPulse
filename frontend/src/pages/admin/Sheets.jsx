import React, { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { api } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/StatusBadge";
import { exportCSV, formatDate, formatDateTime, todayISO } from "@/utils/helpers";

export default function AdminSheets() {
  const [sheets, setSheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ from: todayISO().slice(0, 8) + "01", to: todayISO(), employee_id: "all", status: "all" });
  const [view, setView] = useState(null); // {sheet, template}

  const load = async () => {
    const params = { from: filters.from, to: filters.to };
    if (filters.employee_id !== "all") params.employee_id = filters.employee_id;
    if (filters.status !== "all") params.status = filters.status;
    const { data } = await api.get("/sheets", { params });
    setSheets(data.data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);
  useEffect(() => {
    api.get("/employees", { params: { is_active: true, role: "employee" } }).then((r) => setEmployees(r.data.data || []));
  }, []);

  const openSheet = async (s) => {
    const { data } = await api.get(`/sheets/${s.employee_id}/${s.date}`);
    setView({ ...data.data, employee_name: s.employee_name });
  };

  const onExport = () => {
    exportCSV("activity-sheets.csv", sheets.map((s) => ({
      date: s.date, employee: s.employee_name, status: s.status, submitted_at: s.submitted_at || "",
    })));
  };

  return (
    <div data-testid="admin-sheets" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Compliance</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Activity sheets</h1>
        </div>
        <Button onClick={onExport} variant="outline" className="rounded-xl" data-testid="export-sheets-csv">
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 bg-white p-4 border border-[#e5e3db] rounded-xl">
        <div><Label className="text-xs">From</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} data-testid="filter-from" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} data-testid="filter-to" /></div>
        <div>
          <Label className="text-xs">Employee</Label>
          <Select value={filters.employee_id} onValueChange={(v) => setFilters({ ...filters, employee_id: v })}>
            <SelectTrigger data-testid="filter-employee"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30">
            <tr className="text-left">
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Employee</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider">Submitted at</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {sheets.map((s) => (
              <tr
                key={s.id}
                data-testid={`sheet-row-${s.id}`}
                className={`hover:bg-[#fef8f0]/40 transition-colors ${s.status === "missed" ? "bg-rose-50/40" : ""}`}
              >
                <td className="px-5 py-3 font-medium">{formatDate(s.date)}</td>
                <td className="px-5 py-3 text-stone-700">{s.employee_name}</td>
                <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-5 py-3 text-stone-600">{s.submitted_at ? formatDateTime(s.submitted_at) : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => openSheet(s)}
                    data-testid={`view-sheet-${s.id}`}
                    className="px-2.5 py-1.5 rounded-md text-xs hover:bg-[#f5e8d3]/60 inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
            {sheets.length === 0 && (<tr><td colSpan={5} className="px-5 py-10 text-center text-stone-500">No sheets in this range.</td></tr>)}
          </tbody>
        </table>
      </div>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="rounded-2xl max-w-2xl" data-testid="sheet-view-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              Sheet — {view?.sheet?.date ? formatDate(view.sheet.date) : ""} · {view?.employee_name}
            </DialogTitle>
          </DialogHeader>
          {view?.sheet ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><StatusBadge status={view.sheet.status} /> <span className="text-xs text-stone-500">{view.sheet.submitted_at ? formatDateTime(view.sheet.submitted_at) : ""}</span></div>
              <ul className="space-y-2">
                {(view.template || []).map((t) => {
                  const e = (view.sheet.entries || []).find((x) => x.template_id === t.id);
                  return (
                    <li key={t.id} className="border border-[#e5e3db] rounded-lg p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        {e?.remarks && <p className="text-xs text-stone-500 mt-1">"{e.remarks}"</p>}
                      </div>
                      <StatusBadge status={e?.status || "—"} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="text-sm text-stone-500">No sheet data.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
