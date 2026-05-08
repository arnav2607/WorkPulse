import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex bg-[#fdfbf7]">
      <Sidebar role={user?.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar role={user?.role} />
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1600px] w-full">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
