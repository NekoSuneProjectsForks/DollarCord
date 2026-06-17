"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { User } from "@/types";

interface Props { user: User }

export function AccountSettings({ user }: Props) {
  const router = useRouter();
  const { setUser } = useAuth();
  const { addToast } = useToast();

  const [username, setUsername] = useState(user.username);
  const [savingUsername, setSavingUsername] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  async function changeUsername(e: React.FormEvent) {
    e.preventDefault();
    if (username === user.username) return;
    setSavingUsername(true);
    try {
      const res = await fetch("/api/account/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to change username", "error");
        return;
      }
      setUser(data.user);
      addToast("Username updated!", "success");
      router.refresh();
    } finally {
      setSavingUsername(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      addToast("New passwords do not match", "error");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to change password", "error");
        return;
      }
      setPw({ current: "", next: "", confirm: "" });
      addToast("Password changed. Other sessions were logged out.", "success");
    } finally {
      setSavingPw(false);
    }
  }

  const inputCls =
    "w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm";
  const labelCls = "block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5";

  return (
    <>
      <h2 className="text-dc-text text-xl font-bold mb-6">Account</h2>

      <div className="bg-dc-sidebar rounded-lg p-4 space-y-3 mb-6">
        <div>
          <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Email</p>
          <p className="text-dc-text text-sm">{user.email}</p>
        </div>
        <div>
          <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Platform Role</p>
          <p className="text-dc-text text-sm">{user.isPlatformAdmin ? "DollarCord Admin" : "User"}</p>
        </div>
      </div>

      {/* Change username */}
      <form onSubmit={changeUsername} className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Change Username</h3>
        <div>
          <label className={labelCls}>Username</label>
          <div className="flex items-center bg-dc-input rounded border border-dc-border focus-within:border-dc-accent">
            <span className="pl-3 text-dc-muted">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
              className="flex-1 bg-transparent text-dc-text px-2 py-2 focus:outline-none text-sm"
            />
          </div>
          <p className="text-dc-faint text-xs mt-1">You can change your username once per hour.</p>
        </div>
        <button
          type="submit"
          disabled={savingUsername || username === user.username || username.length < 2}
          className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
        >
          {savingUsername ? "Saving…" : "Update Username"}
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={changePassword} className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Change Password</h3>
        <div>
          <label className={labelCls}>Current Password</label>
          <input
            type="password"
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            className={inputCls}
            autoComplete="current-password"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>New Password</label>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingPw || !pw.current || pw.next.length < 8}
          className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
        >
          {savingPw ? "Saving…" : "Change Password"}
        </button>
      </form>
    </>
  );
}
