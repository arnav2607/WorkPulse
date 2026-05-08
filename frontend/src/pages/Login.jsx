import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/Logo";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/af951721-d124-416e-ae7b-24717e22921d/images/3dcc1df6bc3d0c06dd586e4f257c914ef9eb672e36c14dc485a7e9ab040a5d35.png";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}`);
      if (u.must_change_password) {
        nav("/change-password", { replace: true });
      } else {
        nav(u.role === "admin" ? "/admin/dashboard" : "/employee/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#fdfbf7]">
      {/* Hero side */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#14532d]/85 via-[#14532d]/55 to-transparent" />
        <div className="relative z-10 flex items-center gap-2 text-white">
          <Logo />
        </div>
        <div className="relative z-10 max-w-md text-white">
          <p className="text-[11px] uppercase tracking-[0.2em] opacity-80 mb-3">Operations, simplified</p>
          <h2 className="font-display text-4xl leading-tight font-semibold">
            Run a calmer, more accountable team — every single day.
          </h2>
          <p className="mt-4 text-white/85 leading-relaxed">
            WorkPulse keeps tasks, daily activity sheets and leave requests in one place — so nothing
            falls through the cracks.
          </p>
        </div>
        <div className="relative z-10 text-white/70 text-xs flex items-center gap-3">
          <span className="w-1 h-1 rounded-full bg-white/70" />
          A self-hosted ops cockpit · Built with care
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="lg:hidden mb-8"><Logo /></div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Sign in</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">Welcome back</h1>
          <p className="text-sm text-stone-600 mb-8">
            Use your work email and password. The same form works for admins and employees.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@workpulse.com"
                data-testid="login-email-input"
                className="h-11 bg-white border-[#e5e3db] focus:ring-2 focus:ring-[#14532d]/20 focus:border-[#14532d]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                  className="h-11 pr-10 bg-white border-[#e5e3db] focus:ring-2 focus:ring-[#14532d]/20 focus:border-[#14532d]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
                  aria-label="Toggle password"
                  data-testid="toggle-password-btn"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            data-testid="login-submit-btn"
            className="w-full mt-7 h-11 bg-[#14532d] hover:bg-[#166534] text-white rounded-xl font-medium"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
