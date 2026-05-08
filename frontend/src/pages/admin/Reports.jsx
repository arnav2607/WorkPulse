import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { exportCSV, todayISO } from "@/utils/helpers";

export default function Reports() {
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    from: todayISO().slice(0, 8) + "01",
    to: todayISO(),
    employee_id: "all",
  });
  const [report, setReport] = useState({ rows: [] });

  const load = async () => {
    const params = { from: filters.from, to: filters.to };
    if (filters.employee_id !== "all") params.employee_id = filters.employee_id;
    const { data } = await api.get("/reports", { params });
    setReport(data.data || { rows: [] });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);
  useEffect(() => {
    api.get("/employees", { params: { is_active: true, role: "employee" } }).then((r) => setEmployees(r.data.data || []));
  }, []);

  const onExport = () => {
    const rows = report.rows.map((r) => ({
      employee: r.employee_name,
      department: r.department,
      tasks_assigned: r.tasks_assigned,
      tasks_completed: r.tasks_completed,
      tasks_delayed: r.tasks_delayed,
      sheet_compliance_pct: r.sheet_compliance,
      casual_taken: r.leaves.casual,
      sick_taken: r.leaves.sick,
      half_day_taken: r.leaves.half_day,
      wfh_taken: r.leaves.wfh,
      productivity_score: r.productivity_score,
    }));
    exportCSV(`workpulse-report-${filters.from}-to-${filters.to}.csv`, rows);
  };

  return (
    <div data-testid="admin-reports" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-1">Insights</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reports</h1>
        </div>
        <Button onClick={onExport} variant="outline" className="rounded-xl" data-testid="export-report-btn">
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 bg-white p-4 border border-[#e5e3db] rounded-xl">
        <div><Label className="text-xs">From</Label><Input type="date" data-testid="report-from" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" data-testid="report-to" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Employee</Label>
          <Select value={filters.employee_id} onValueChange={(v) => setFilters({ ...filters, employee_id: v })}>
            <SelectTrigger data-testid="report-emp"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border border-[#e5e3db] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5e8d3]/30 text-left">
            <tr>
              {["Employee", "Department", "Assigned", "Completed", "Delayed", "Sheet %", "Casual", "Sick", "WFH", "Half day", "Productivity"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-stone-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e3db]">
            {report.rows.map((r) => (
              <tr key={r.employee_id} data-testid={`report-row-${r.employee_id}`}>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{r.employee_name}</td>
                <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{r.department || "—"}</td>
                <td className="px-4 py-3">{r.tasks_assigned}</td>
                <td className="px-4 py-3 text-emerald-700 font-medium">{r.tasks_completed}</td>
                <td className="px-4 py-3 text-rose-700 font-medium">{r.tasks_delayed}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.sheet_compliance >= 80 ? "bg-emerald-100 text-emerald-800" : r.sheet_compliance >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>{r.sheet_compliance}%</span></td>
                <td className="px-4 py-3">{r.leaves.casual}</td>
                <td className="px-4 py-3">{r.leaves.sick}</td>
                <td className="px-4 py-3">{r.leaves.wfh}</td>
                <td className="px-4 py-3">{r.leaves.half_day}</td>
                <td className="px-4 py-3 font-display font-semibold text-[#14532d]">{r.productivity_score}</td>
              </tr>
            ))}
            {report.rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-stone-500">No data for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
