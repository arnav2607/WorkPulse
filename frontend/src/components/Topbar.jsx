import React, { useEffect, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { LogOut, ChevronDown, Menu, KeyRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

export default function Topbar({ role }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [todaySheetStatus, setTodaySheetStatus] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (role !== "employee") return;
    const fetchSheet = async () => {
      try {
        const { data } = await api.get("/sheets/today");
        setTodaySheetStatus(data.data.sheet?.status || "draft");
      } catch (e) {}
    };
    fetchSheet();
    const t = setInterval(fetchSheet, 60000);
    return () => clearInterval(t);
  }, [role]);

  const handleLogoutClick = () => {
    if (role === "employee" && todaySheetStatus !== "submitted" && todaySheetStatus !== "on_leave") {
      setConfirm(true);
    } else {
      doLogout();
    }
  };

  const doLogout = () => {
    logout();
    nav("/login");
  };

  const initials = (user?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const showSheetWarning = role === "employee" && todaySheetStatus !== "submitted" && todaySheetStatus !== "on_leave";

  return (
    <>
      <header
        data-testid="topbar"
        className="sticky top-0 z-40 glass border-b border-[#e5e3db]/60 px-4 lg:px-8 h-16 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-[#f5e8d3]/60"
            onClick={() => setMobileNav((v) => !v)}
            aria-label="Open menu"
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden"><Logo withText={false} /></div>
          <div className="hidden lg:block">
            <h1 className="font-display text-lg font-medium tracking-tight">
              {role === "admin" ? "Operations Console" : "My Workspace"}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {showSheetWarning && (
            <NavLink
              to="/employee/sheet"
              data-testid="sheet-warning-banner"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200 hover:bg-amber-200 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Today's sheet pending
            </NavLink>
          )}
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="user-menu-trigger"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f5e8d3]/60 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#14532d] text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-stone-500">{user?.role}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-stone-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" data-testid="user-menu-content">
              <DropdownMenuLabel className="text-stone-500 text-xs uppercase tracking-wider">
                Signed in as
              </DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal -mt-1">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-stone-500">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/change-password")} data-testid="change-password-menu-item">
                <KeyRound className="w-4 h-4 mr-2" /> Change password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogoutClick} data-testid="logout-menu-item">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileNav && (
        <MobileNav role={role} close={() => setMobileNav(false)} />
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent data-testid="logout-confirm-dialog" className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Submit today's sheet first</DialogTitle>
            <DialogDescription className="pt-2">
              You have not submitted today's activity sheet yet. Please submit it before logging out — this is required by your administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} data-testid="logout-cancel-btn">
              Cancel
            </Button>
            <Button
              className="bg-[#14532d] hover:bg-[#166534]"
              data-testid="goto-sheet-btn"
              onClick={() => { setConfirm(false); nav("/employee/sheet"); }}
            >
              Go to sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MobileNav({ role, close }) {
  const items = role === "admin"
    ? [
      ["/admin/dashboard", "Dashboard"], ["/admin/employees", "Employees"],
      ["/admin/tasks", "Tasks"], ["/admin/templates", "Activity Template"],
      ["/admin/sheets", "Activity Sheets"], ["/admin/leaves", "Leaves"], ["/admin/reports", "Reports"],
    ]
    : [
      ["/employee/dashboard", "Dashboard"], ["/employee/tasks", "My Tasks"],
      ["/employee/sheet", "Daily Sheet"], ["/employee/leaves", "Leaves"],
    ];
  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={close}>
      <nav
        className="absolute left-0 top-0 bottom-0 w-64 bg-[#fef8f0] border-r border-[#e5e3db] p-4 space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-3"><Logo /></div>
        {items.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className={({ isActive }) =>
              `block px-3 py-2.5 rounded-lg text-sm ${isActive ? "bg-[#14532d] text-white" : "text-stone-700 hover:bg-[#f5e8d3]/60"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
