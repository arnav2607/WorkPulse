import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, ListTodo, ClipboardList, FileSpreadsheet,
  CalendarRange, BarChart3, ListChecks, Plane, FileEdit
} from "lucide-react";
import Logo from "@/components/Logo";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/tasks", label: "Tasks", icon: ListTodo },
  { to: "/admin/templates", label: "Activity Template", icon: ClipboardList },
  { to: "/admin/sheets", label: "Activity Sheets", icon: FileSpreadsheet },
  { to: "/admin/leaves", label: "Leaves", icon: CalendarRange },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
];

const EMPLOYEE_NAV = [
  { to: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employee/tasks", label: "My Tasks", icon: ListChecks },
  { to: "/employee/sheet", label: "Daily Sheet", icon: FileEdit },
  { to: "/employee/leaves", label: "Leaves", icon: Plane },
];

export default function Sidebar({ role }) {
  const items = role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;
  return (
    <aside
      data-testid="sidebar"
      className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[#e5e3db] bg-[#fef8f0] sticky top-0 h-screen"
    >
      <div className="px-5 py-5 border-b border-[#e5e3db]">
        <Logo />
      </div>
      <nav className="flex-1 p-3 space-y-1 scrollbar-thin overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#14532d] text-white shadow-sm"
                  : "text-stone-700 hover:bg-[#f5e8d3]/60"
              }`
            }
          >
            <it.icon className="w-4 h-4" />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 text-[11px] text-stone-500 border-t border-[#e5e3db]">
        WorkPulse v1.0
      </div>
    </aside>
  );
}
