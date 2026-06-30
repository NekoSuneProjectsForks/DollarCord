"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import type { User } from "@/types";

interface Props {
  user: User;
  onLogout: () => void;
  onSettings?: () => void;
}

const STATUS_OPTIONS: { value: "ONLINE" | "IDLE" | "DND" | "INVISIBLE"; label: string; dot: string }[] = [
  { value: "ONLINE", label: "Online", dot: "bg-dc-success" },
  { value: "IDLE", label: "Idle", dot: "bg-dc-warning" },
  { value: "DND", label: "Do Not Disturb", dot: "bg-dc-danger" },
  { value: "INVISIBLE", label: "Invisible", dot: "bg-dc-faint" },
];

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.86.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.86L4.2 7.08a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.86-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.58 0 1.1.23 1.46.6.37.36.6.88.6 1.46s-.23 1.1-.6 1.46c-.36.37-.88.6-1.46.6h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function UserBar({ user, onLogout, onSettings }: Props) {
  const { setUser } = useAuth();
  const { socket } = useSocket();
  const [showStatus, setShowStatus] = useState(false);

  async function setStatus(status: "ONLINE" | "IDLE" | "DND" | "INVISIBLE") {
    setShowStatus(false);
    setUser({ ...user, status });
    socket?.emit("presence:status", { status });
    const res = await fetch("/api/users/me/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) setUser(data.user);
    }
  }

  return (
    <div className="relative border-t border-dc-border bg-dc-overlay px-2 py-2 flex items-center gap-2 shrink-0">
      {showStatus && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowStatus(false)} />
          <div className="absolute bottom-full left-2 z-50 mb-1 w-48 rounded-lg border border-dc-border bg-dc-rail shadow-xl overflow-hidden">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dc-text hover:bg-dc-hover"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
                {opt.label}
                {(user.status || "ONLINE") === opt.value && <span className="ml-auto text-dc-accent">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
      <button onClick={() => setShowStatus((s) => !s)} title="Change status" className="shrink-0">
        <Avatar user={user} size="sm" online={user.status !== "INVISIBLE"} status={(user.status as string) || "ONLINE"} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-dc-text text-sm font-semibold truncate">{user.displayName}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-dc-muted text-xs truncate">@{user.username}</p>
          {user.isPlatformAdmin && (
            <span className="shrink-0 rounded-full bg-dc-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
              Admin
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onSettings ? (
          <button
            onClick={onSettings}
            className="w-7 h-7 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        ) : (
          <Link
            href="/settings"
            className="w-7 h-7 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
            title="Settings"
          >
            <SettingsIcon />
          </Link>
        )}
        <button
          onClick={onLogout}
          className="w-7 h-7 flex items-center justify-center text-dc-muted hover:text-dc-danger hover:bg-dc-hover rounded transition-colors"
          title="Logout"
        >
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}
