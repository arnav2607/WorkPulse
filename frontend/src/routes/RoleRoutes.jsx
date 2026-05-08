import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function AdminRoute({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (user.role !== "admin") return <Navigate to="/employee/dashboard" replace />;
  return children;
}

export function EmployeeRoute({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (user.role !== "employee") return <Navigate to="/admin/dashboard" replace />;
  return children;
}
