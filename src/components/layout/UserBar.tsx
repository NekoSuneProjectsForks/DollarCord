"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/types";

interface Props {
  user: User;
  onLogout: () => void;
  onSettings?: () => void;
}

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
  return (
    <div className="border-t border-dc-border bg-dc-overlay px-2 py-2 flex items-center gap-2 shrink-0">
      <Avatar user={user} size="sm" online={user.status !== "INVISIBLE"} status={(user.status as string) || "ONLINE"} />
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
