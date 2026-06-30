"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendEntry } from "@/types";

interface FriendsData {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  blocked: FriendEntry[];
}

type Tab = "friends" | "pending" | "blocked";

export default function FriendsPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [data, setData] = useState<FriendsData | null>(null);
  const [tab, setTab] = useState<Tab>("friends");
  const [username, setUsername] = useState("");

  const load = useCallback(() => {
    fetch("/api/friends").then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!socket) return;
    socket.on("friends:update", load);
    return () => { socket.off("friends:update", load); };
  }, [socket, load]);

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { addToast(d.error || "Failed", "error"); return; }
    addToast("Friend request sent.", "success");
    setUsername("");
    load();
  }

  async function act(userId: string, action: string) {
    await fetch("/api/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    load();
  }

  async function startDm(userId: string) {
    const res = await fetch("/api/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
    const d = await res.json();
    if (res.ok && d.thread?.id) router.push(`/channels/${d.thread.id}`);
  }

  const pending = data ? [...data.incoming, ...data.outgoing] : [];
  const incomingIds = new Set(data?.incoming.map((e) => e.user.id));

  function Row({ entry, children }: { entry: FriendEntry; children: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 rounded px-3 py-2 hover:bg-dc-hover">
        <Avatar user={entry.user} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dc-text truncate">{entry.user.displayName}</p>
          <p className="text-xs text-dc-faint truncate">@{entry.user.username}</p>
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
    );
  }

  const btn = "rounded px-3 py-1 text-xs font-semibold";

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-dc-chat">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h1 className="text-dc-text text-2xl font-bold mb-4">Friends</h1>

        <form onSubmit={addFriend} className="flex gap-2 mb-6">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Add a friend by username"
            className="flex-1 bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
          />
          <button className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover">Send Request</button>
        </form>

        <div className="flex gap-2 mb-3 border-b border-dc-border">
          {(["friends", "pending", "blocked"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize ${tab === t ? "text-dc-text border-b-2 border-dc-accent" : "text-dc-muted"}`}
            >
              {t}{t === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
            </button>
          ))}
        </div>

        {!data ? (
          <p className="text-dc-muted text-sm">Loading…</p>
        ) : tab === "friends" ? (
          data.friends.length === 0 ? <p className="text-dc-muted text-sm">No friends yet.</p> :
          data.friends.map((e) => (
            <Row key={e.id} entry={e}>
              <button onClick={() => startDm(e.user.id)} className={`${btn} bg-dc-accent text-white`}>Message</button>
              <button onClick={() => act(e.user.id, "remove")} className={`${btn} bg-dc-hover text-dc-text`}>Remove</button>
              <button onClick={() => act(e.user.id, "block")} className={`${btn} bg-dc-danger/15 text-dc-danger`}>Block</button>
            </Row>
          ))
        ) : tab === "pending" ? (
          pending.length === 0 ? <p className="text-dc-muted text-sm">No pending requests.</p> :
          pending.map((e) => (
            <Row key={e.id} entry={e}>
              {incomingIds.has(e.user.id) ? (
                <>
                  <button onClick={() => act(e.user.id, "accept")} className={`${btn} bg-dc-success text-white`}>Accept</button>
                  <button onClick={() => act(e.user.id, "remove")} className={`${btn} bg-dc-hover text-dc-text`}>Ignore</button>
                </>
              ) : (
                <button onClick={() => act(e.user.id, "remove")} className={`${btn} bg-dc-hover text-dc-text`}>Cancel</button>
              )}
            </Row>
          ))
        ) : (
          data.blocked.length === 0 ? <p className="text-dc-muted text-sm">No blocked users.</p> :
          data.blocked.map((e) => (
            <Row key={e.id} entry={e}>
              <button onClick={() => act(e.user.id, "unblock")} className={`${btn} bg-dc-hover text-dc-text`}>Unblock</button>
            </Row>
          ))
        )}
      </div>
    </div>
  );
}
