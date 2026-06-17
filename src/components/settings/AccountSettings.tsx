"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { formatDate } from "@/lib/dateTime";
import type { User } from "@/types";

interface Props { user: User }

interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export function AccountSettings({ user }: Props) {
  const router = useRouter();
  const { setUser } = useAuth();
  const { addToast } = useToast();

  const [username, setUsername] = useState(user.username);
  const [savingUsername, setSavingUsername] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);

  function loadSessions() {
    fetch("/api/account/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSessions(d.sessions ?? []))
      .catch(() => {});
  }
  useEffect(loadSessions, []);

  async function revokeSession(id?: string) {
    await fetch(`/api/account/sessions${id ? `?id=${id}` : ""}`, { method: "DELETE" });
    addToast(id ? "Session revoked." : "Other sessions logged out.", "success");
    loadSessions();
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and all servers you own? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to delete account", "error");
        return;
      }
      window.location.href = "/login";
    } finally {
      setDeleting(false);
    }
  }

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
            <PasswordStrength password={pw.next} />
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

      {/* Active sessions */}
      <div className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-dc-text font-semibold">Active Sessions</h3>
          {sessions.length > 1 && (
            <button onClick={() => revokeSession()} className="text-xs text-dc-accent hover:underline">
              Log out everywhere else
            </button>
          )}
        </div>
        {sessions.length === 0 ? (
          <p className="text-dc-muted text-sm">No active sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded bg-dc-chat px-3 py-2 text-sm">
                <div>
                  <p className="text-dc-text">
                    Session {s.current && <span className="text-dc-success text-xs">(this device)</span>}
                  </p>
                  <p className="text-dc-faint text-xs">Signed in {formatDate(s.createdAt)}</p>
                </div>
                {!s.current && (
                  <button onClick={() => revokeSession(s.id)} className="text-xs text-dc-danger hover:underline">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data export */}
      <div className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Your Data</h3>
        <p className="text-dc-muted text-sm">Download a copy of your profile, messages, DMs, and memberships.</p>
        <a
          href="/api/account/export"
          className="inline-block px-5 py-2 bg-dc-hover hover:bg-dc-border text-dc-text text-sm font-semibold rounded transition-colors"
        >
          Export My Data
        </a>
      </div>

      {/* Delete account */}
      <div className="rounded-lg border border-dc-danger/20 bg-dc-danger/10 p-4 space-y-3">
        <h3 className="text-dc-danger font-semibold">Delete Account</h3>
        <p className="text-dc-muted text-sm">
          Permanently deletes your account and every server you own. Enter your password to confirm.
        </p>
        <input
          type="password"
          value={deletePw}
          onChange={(e) => setDeletePw(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          className={inputCls}
        />
        <button
          onClick={deleteAccount}
          disabled={deleting || !deletePw}
          className="px-5 py-2 bg-dc-danger hover:bg-dc-danger-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
        >
          {deleting ? "Deleting…" : "Delete My Account"}
        </button>
      </div>
    </>
  );
}
