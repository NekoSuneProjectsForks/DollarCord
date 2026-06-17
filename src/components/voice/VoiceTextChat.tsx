"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { Avatar } from "@/components/ui/Avatar";
import { formatTime } from "@/lib/dateTime";
import type { Message, User } from "@/types";

interface Props {
  channelId: string;
  currentUser: User;
}

// Compact Discord-style text chat attached to a voice channel. Reuses the same
// channel messages API + Socket.IO events as regular text channels.
export function VoiceTextChat({ channelId, currentUser }: Props) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/channels/${channelId}/messages?limit=30`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => active && data && setMessages((data.messages ?? []).slice().reverse()))
      .catch(() => {});
    return () => { active = false; };
  }, [channelId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("channel:join", channelId);
    const onMessage = (msg: Message) => {
      if (msg.channelId !== channelId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    socket.on("channel:message", onMessage);
    return () => {
      socket.off("channel:message", onMessage);
      socket.emit("channel:leave", channelId);
    };
  }, [socket, channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-dc-border bg-dc-sidebar">
      <div className="flex h-10 items-center gap-2 border-b border-dc-border px-3 text-sm font-semibold text-dc-text">
        <span className="text-dc-muted">#</span> Voice chat
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 && <p className="text-dc-muted text-xs">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            {m.user && <Avatar user={m.user} size="xs" />}
            <div className="min-w-0">
              <p className="text-xs">
                <span className="font-semibold text-dc-text">{m.user?.displayName ?? "Unknown"}</span>{" "}
                <span className="text-dc-faint">{formatTime(m.createdAt)}</span>
              </p>
              <p className="text-sm text-dc-muted break-words whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-dc-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          maxLength={4000}
          className="w-full rounded bg-dc-input px-3 py-2 text-sm text-dc-text border border-dc-border focus:border-dc-accent focus:outline-none"
        />
      </form>
    </div>
  );
}
