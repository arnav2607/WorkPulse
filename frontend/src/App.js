import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminRoute, EmployeeRoute } from "@/routes/RoleRoutes";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ChangePassword from "@/pages/ChangePassword";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminEmployees from "@/pages/admin/Employees";
import AdminTasks from "@/pages/admin/Tasks";
import AdminTaskDetail from "@/pages/admin/TaskDetail";
import AdminTemplates from "@/pages/admin/ActivityTemplates";
import AdminSheets from "@/pages/admin/Sheets";
import AdminLeaves from "@/pages/admin/Leaves";
import AdminReports from "@/pages/admin/Reports";
import EmpDashboard from "@/pages/employee/Dashboard";
import EmpTasks from "@/pages/employee/MyTasks";
import EmpTaskDetail from "@/pages/employee/TaskDetail";
import EmpSheet from "@/pages/employee/DailySheet";
import EmpLeaves from "@/pages/employee/Leaves";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard"} replace />;
}

function PasswordGate({ children }) {
  const { user } = useAuth();
  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<AdminRoute><PasswordGate><Layout /></PasswordGate></AdminRoute>}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/employees" element={<AdminEmployees />} />
            <Route path="/admin/tasks" element={<AdminTasks />} />
            <Route path="/admin/tasks/:taskId" element={<AdminTaskDetail />} />
            <Route path="/admin/templates" element={<AdminTemplates />} />
            <Route path="/admin/sheets" element={<AdminSheets />} />
            <Route path="/admin/leaves" element={<AdminLeaves />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>

          <Route element={<EmployeeRoute><PasswordGate><Layout /></PasswordGate></EmployeeRoute>}>
            <Route path="/employee/dashboard" element={<EmpDashboard />} />
            <Route path="/employee/tasks" element={<EmpTasks />} />
            <Route path="/employee/tasks/:taskId" element={<EmpTaskDetail />} />
            <Route path="/employee/sheet" element={<EmpSheet />} />
            <Route path="/employee/leaves" element={<EmpLeaves />} />
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
