"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { formatShortDate } from "@/lib/dateTime";
import type { Attachment, Message, User } from "@/types";

interface ThreadSummary {
  id: string;
  name: string;
  channelId: string;
  rootMessageId: string | null;
  lastMessageAt: string;
  createdAt: string;
  unread?: boolean;
  _count?: { messages: number };
}

interface Props {
  channelId: string;
  serverId: string;
  currentUser: User;
  initialThreadId?: string | null;
  seedFromMessage?: Message | null;
  onClose: () => void;
}

const noop = async () => {};

export function ThreadPanel({ channelId, serverId, currentUser, initialThreadId, seedFromMessage, onClose }: Props) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [active, setActive] = useState<ThreadSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [creating, setCreating] = useState(Boolean(seedFromMessage));
  const [newName, setNewName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load the thread list.
  function loadThreads() {
    fetch(`/api/channels/${channelId}/threads`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setThreads(d.threads ?? []))
      .catch(() => {});
  }
  useEffect(loadThreads, [channelId]);

  // Open a thread passed in directly.
  useEffect(() => {
    if (initialThreadId) {
      fetch(`/api/channels/${channelId}/threads`)
        .then((r) => r.json())
        .then((d) => {
          const t = (d.threads ?? []).find((x: ThreadSummary) => x.id === initialThreadId);
          if (t) openThread(t);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId]);

  function openThread(t: ThreadSummary) {
    setActive(t);
    setCreating(false);
    fetch(`/api/threads/${t.id}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMessages(d.messages ?? []))
      .catch(() => {});
    // Mark read + clear the local unread dot.
    fetch(`/api/threads/${t.id}/read`, { method: "POST" }).catch(() => {});
    setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, unread: false } : x)));
  }

  // Real-time thread messages for the open thread.
  useEffect(() => {
    if (!socket || !active) return;
    socket.emit("thread:join", active.id);
    const onMsg = (msg: Message) => {
      if (msg.threadId !== active.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      fetch(`/api/threads/${active.id}/read`, { method: "POST" }).catch(() => {});
    };
    socket.on("thread:message", onMsg);
    return () => {
      socket.off("thread:message", onMsg);
      socket.emit("thread:leave", active.id);
    };
  }, [socket, active]);

  // Flag threads unread in the list when activity arrives for one we're not viewing.
  useEffect(() => {
    if (!socket) return;
    const onActivity = ({ channelId: ch, threadId, authorId }: { channelId: string; threadId: string; authorId: string }) => {
      if (ch !== channelId || authorId === currentUser.id || threadId === active?.id) return;
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: true } : t)));
    };
    socket.on("channel:thread:activity", onActivity);
    return () => { socket.off("channel:thread:activity", onActivity); };
  }, [socket, channelId, active, currentUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch(`/api/channels/${channelId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        rootMessageId: seedFromMessage?.id ?? null,
        content: seedFromMessage?.content ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      addToast(data.error || "Failed to create thread", "error");
      return;
    }
    setNewName("");
    loadThreads();
    openThread(data.thread);
  }

  async function sendThreadMessage(content: string, attachments: Attachment[] = []) {
    if (!active) return;
    const res = await fetch(`/api/threads/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, attachments }),
    });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Failed to send", "error");
    }
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-dc-border bg-dc-chat">
      <div className="flex h-12 items-center gap-2 border-b border-dc-border px-3 shrink-0">
        {active || creating ? (
          <button onClick={() => { setActive(null); setCreating(false); }} className="text-dc-muted hover:text-dc-text">←</button>
        ) : null}
        <span className="font-semibold text-dc-text truncate flex-1">
          {active ? active.name : creating ? "New Thread" : "Threads"}
        </span>
        {!active && !creating && (
          <button onClick={() => setCreating(true)} className="text-xs rounded bg-dc-accent px-2 py-1 font-semibold text-white hover:bg-dc-accent-hover">
            New
          </button>
        )}
        <button onClick={onClose} className="text-dc-muted hover:text-dc-text text-lg leading-none">✕</button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={createThread} className="border-b border-dc-border p-3 space-y-2">
          {seedFromMessage && (
            <div className="rounded bg-dc-input p-2 text-xs text-dc-muted">
              From: <span className="text-dc-text">{seedFromMessage.user?.displayName ?? "message"}</span> — {seedFromMessage.content.slice(0, 80)}
            </div>
          )}
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Thread name"
            maxLength={100}
            className="w-full rounded bg-dc-input px-3 py-2 text-sm text-dc-text border border-dc-border focus:border-dc-accent focus:outline-none"
          />
          <button type="submit" disabled={!newName.trim()} className="w-full rounded bg-dc-accent px-3 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50">
            Create Thread
          </button>
        </form>
      )}

      {/* Thread list */}
      {!active && !creating && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {threads.length === 0 ? (
            <p className="text-dc-muted text-sm p-3 text-center">No threads yet. Start one with “New”.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className="block w-full rounded px-3 py-2 text-left hover:bg-dc-hover transition-colors"
              >
                <p className={`text-sm truncate flex items-center gap-1.5 ${t.unread ? "font-bold text-dc-text" : "font-semibold text-dc-text"}`}>
                  {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-dc-danger" />}
                  🧵 {t.name}
                </p>
                <p className="text-xs text-dc-faint">
                  {t._count?.messages ?? 0} message{(t._count?.messages ?? 0) === 1 ? "" : "s"} · {formatShortDate(t.lastMessageAt)}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      {/* Open thread */}
      {active && (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
            {messages.length === 0 && <p className="text-dc-muted text-sm p-3 text-center">No replies yet.</p>}
            {messages.map((m, i) => (
              <MessageItem
                key={m.id}
                message={m}
                isConsecutive={i > 0 && messages[i - 1].userId === m.userId}
                currentUserId={currentUser.id}
                canManage={false}
                onEdit={noop}
                onDelete={noop}
                onReaction={noop}
                onReply={() => {}}
                onTogglePin={noop}
                isPinned={false}
              />
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0">
            <MessageInput
              channelId={active.id}
              channelName={active.name}
              onSend={sendThreadMessage}
              socket={socket}
              isDM={false}
              serverId={serverId}
            />
          </div>
        </>
      )}
    </aside>
  );
}
