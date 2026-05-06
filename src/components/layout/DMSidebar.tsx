"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import { UserBar } from "./UserBar";
import { UserSettingsModal } from "@/components/settings/UserSettingsModal";
import type { DirectMessageThread, User } from "@/types";

interface Props {
  threads: (DirectMessageThread & { otherUser?: User; lastMessage?: { content: string; senderId: string } | null })[];
  currentUserId: string;
}

export function DMSidebar({ threads: initialThreads, currentUserId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { socket, presence } = useSocket();
  const { addToast } = useToast();
  const { user, logout } = useAuth();
  const [threads, setThreads] = useState(initialThreads);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const activeThreadId = pathname.split("/channels/")[1];

  // Listen for new DM threads
  useEffect(() => {
    if (!socket) return;
    socket.on("dm:thread:create", ({ thread }: { thread: DirectMessageThread }) => {
      setThreads((prev) => {
        if (prev.find((t) => t.id === thread.id)) return prev;
        const otherUser = thread.participants.find((p) => p.user.id !== currentUserId)?.user;
        return [{ ...thread, otherUser, lastMessage: null }, ...prev];
      });
    });
    return () => { socket.off("dm:thread:create"); };
  }, [socket, currentUserId]);

  // Debounced user search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function startDM(targetUser: User) {
    const res = await fetch("/api/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: targetUser.id }),
    });
    const data = await res.json();
    setSearch("");
    setSearchResults([]);
    if (data.thread) {
      router.push(`/channels/${data.thread.id}`);
    } else {
      addToast(data.error || "Could not start direct message", "error");
    }
  }

  return (
    <>
      <aside className="w-60 min-h-0 bg-dc-sidebar flex flex-col shrink-0 overflow-visible">
        {/* Header */}
        <div className="px-3 py-3 border-b border-dc-border">
          <div className="relative">
            <input
              type="text"
              placeholder="Find or start a conversation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dc-input text-dc-text text-sm px-3 py-1.5 rounded border border-dc-border focus:border-dc-accent focus:outline-none placeholder-dc-muted"
            />
            {searching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dc-muted text-xs">…</span>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 bg-dc-rail rounded-lg shadow-xl border border-dc-border overflow-hidden w-54">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dc-hover transition-colors"
                  onClick={() => startDM(u)}
                >
                  <Avatar user={u} size="sm" />
                  <div className="text-left min-w-0">
                    <p className="text-dc-text text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-dc-muted text-xs truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section label */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-xs font-semibold text-dc-muted uppercase tracking-wide">
            Direct Messages
          </span>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
          {threads.map((thread) => {
            const other = thread.otherUser;
            if (!other) return null;
            const isActive = activeThreadId === thread.id;
            const isOnline = presence[other.id] ?? false;

            return (
              <Link
                key={thread.id}
                href={`/channels/${thread.id}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  isActive ? "bg-dc-active text-dc-text" : "text-dc-muted hover:text-dc-text hover:bg-dc-hover"
                }`}
              >
                <Avatar user={other} size="sm" online={isOnline} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-dc-text">{other.displayName}</p>
                  {thread.lastMessage && (
                    <p className="text-xs text-dc-muted truncate">
                      {thread.lastMessage.content}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}

          {threads.length === 0 && !search && (
            <p className="text-dc-muted text-xs px-2 py-2">
              No conversations yet. Search for a user above to start one.
            </p>
          )}
        </div>

        {/* User bar */}
        {user && (
          <UserBar
            user={user}
            onLogout={logout}
            onSettings={() => setShowSettings(true)}
          />
        )}
      </aside>

      {user && (
        <UserSettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          user={user}
        />
      )}
    </>
  );
}
