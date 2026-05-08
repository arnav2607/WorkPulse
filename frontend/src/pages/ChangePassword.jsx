import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Shield, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Logo from "@/components/Logo";

export default function ChangePassword() {
  const { user, refreshMe, logout } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const forced = !!user?.must_change_password;

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password changed successfully");
      await refreshMe();
      nav(user?.role === "admin" ? "/admin/dashboard" : "/employee/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="change-password-page" className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="bg-white border border-[#e5e3db] rounded-2xl p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#14532d]/10 text-[#14532d] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {forced ? "Set your new password" : "Change password"}
              </h1>
              <p className="text-sm text-stone-500">
                {forced
                  ? "Your admin set a temporary password — please replace it now."
                  : "Update the password used to sign in to WorkPulse."}
              </p>
            </div>
          </div>

          {forced && (
            <div className="mt-4 mb-2 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              For your account security, you must change your password before continuing.
            </div>
          )}

          <form onSubmit={submit} className="space-y-3 mt-5">
            <div>
              <Label>{forced ? "Temporary password" : "Current password"}</Label>
              <Input
                data-testid="cp-current"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <Label>New password</Label>
              <Input
                data-testid="cp-new"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-[11px] text-stone-500 mt-1">At least 6 characters.</p>
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                data-testid="cp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              data-testid="cp-submit"
              className="w-full bg-[#14532d] hover:bg-[#166534] rounded-xl mt-2"
            >
              <Lock className="w-4 h-4 mr-1" />
              {busy ? "Updating…" : "Update password"}
              {!busy && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          </form>
          {!forced && (
            <button
              type="button"
              onClick={() => nav(-1)}
              className="w-full text-sm text-stone-500 hover:text-stone-700 mt-3"
            >
              Cancel
            </button>
          )}
          {forced && (
            <button
              type="button"
              onClick={() => { logout(); nav("/login"); }}
              data-testid="cp-logout"
              className="w-full text-sm text-stone-500 hover:text-stone-700 mt-3"
            >
              Sign out instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
