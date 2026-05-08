import React, { useState } from "react";
import { Copy, Check, Mail, Key, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function CredentialModal({ creds, onClose }) {
  const [copied, setCopied] = useState("");

  const copy = (label, text) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  const summary = creds
    ? `WorkPulse account\nLogin: ${creds.email}\nTemporary password: ${creds.initial_password}\n(Please change it on first login.)`
    : "";

  return (
    <Dialog open={!!creds} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl" data-testid="credential-modal">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Employee created
          </DialogTitle>
          <DialogDescription>
            Share these credentials with <span className="font-medium text-stone-700">{creds?.name}</span>.
            They will be required to change the password on their first login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row
            icon={<Mail className="w-4 h-4 text-stone-500" />}
            label="Login email"
            value={creds?.email || ""}
            copied={copied === "email"}
            onCopy={() => copy("email", creds?.email || "")}
            testid="cred-email"
          />
          <Row
            icon={<Key className="w-4 h-4 text-stone-500" />}
            label="Temporary password"
            value={creds?.initial_password || ""}
            copied={copied === "pwd"}
            onCopy={() => copy("pwd", creds?.initial_password || "")}
            mono
            testid="cred-password"
          />
          <button
            type="button"
            onClick={() => copy("all", summary)}
            data-testid="cred-copy-all"
            className="w-full text-xs text-[#14532d] hover:underline pt-1 inline-flex items-center justify-center gap-1"
          >
            {copied === "all" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied === "all" ? "Copied full message" : "Copy a ready-to-share message"}
          </button>
        </div>

        <div className="text-[11px] text-stone-500 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          ⚠️ This password will not be shown again. Save it now if needed.
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-[#14532d] hover:bg-[#166534]" data-testid="cred-done-btn">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, label, value, copied, onCopy, mono, testid }) {
  return (
    <div className="bg-stone-50 border border-[#e5e3db] rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-stone-500">{label}</p>
          <p data-testid={testid} className={`text-sm truncate ${mono ? "font-mono" : "font-medium"} text-stone-800`}>
            {value}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="p-1.5 rounded-md hover:bg-white text-stone-600"
        title="Copy"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
