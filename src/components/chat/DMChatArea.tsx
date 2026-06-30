"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import { TypingIndicator } from "./TypingIndicator";
import { MessageInput } from "./MessageInput";
import { CallPanel } from "./CallPanel";
import { formatRelativeDate, formatTime } from "@/lib/dateTime";
import { effectiveStatus, isShownOnline } from "@/lib/presenceStatus";
import type { DirectMessage, DirectMessageThread, User, TypingUser } from "@/types";

interface Props {
  thread: DirectMessageThread;
  currentUser: User;
  otherUser: User;
  initialMessages: DirectMessage[];
}

export function DMChatArea({ thread, currentUser, otherUser, initialMessages }: Props) {
  const { socket, presence, statuses } = useSocket();
  const { addToast } = useToast();
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [hasMore, setHasMore] = useState(initialMessages.length === 50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callWithVideo, setCallWithVideo] = useState(false);
  const [incoming, setIncoming] = useState<{ withVideo: boolean; from: { displayName: string } } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const participantIds = thread.participants.map((p) => p.user.id);

  function startCall(withVideo: boolean) {
    setCallWithVideo(withVideo);
    setInCall(true);
    setIncoming(null);
    socket?.emit("dm:call:ring", { threadId: thread.id, participantIds, withVideo });
  }
  function acceptCall() {
    setCallWithVideo(incoming?.withVideo ?? false);
    setInCall(true);
    setIncoming(null);
  }

  const scrollToBottom = useCallback(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [thread.id, scrollToBottom]);
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current;
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (near) scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("dm:join", thread.id);

    socket.on("dm:message", (msg: DirectMessage) => {
      if (msg.threadId !== thread.id) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("dm:typing:start", (data: TypingUser & { threadId: string }) => {
      if (data.threadId !== thread.id || data.userId === currentUser.id) return;
      setTypingUsers((prev) => {
        if (prev.find((u) => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username, displayName: data.displayName }];
      });
    });

    socket.on("dm:typing:stop", ({ threadId, userId }: { threadId: string; userId: string }) => {
      if (threadId !== thread.id) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    socket.on("dm:call:incoming", (data: { threadId: string; withVideo: boolean; from: { displayName: string } }) => {
      if (data.threadId !== thread.id) return;
      setIncoming({ withVideo: data.withVideo, from: data.from });
    });
    socket.on("dm:call:cancel", ({ threadId }: { threadId: string }) => {
      if (threadId === thread.id) setIncoming(null);
    });

    return () => {
      socket.emit("dm:leave", thread.id);
      socket.off("dm:message");
      socket.off("dm:typing:start");
      socket.off("dm:typing:stop");
      socket.off("dm:call:incoming");
      socket.off("dm:call:cancel");
    };
  }, [socket, thread.id, currentUser.id]);

  async function sendMessage(content: string) {
    const res = await fetch(`/api/dm/${thread.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Failed to send", "error");
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const cursor = messages[0]?.createdAt;
    const res = await fetch(`/api/dm/${thread.id}/messages?cursor=${encodeURIComponent(String(cursor))}`);
    const data = await res.json();
    setMessages((prev) => [...(data.messages ?? []), ...prev]);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: DirectMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatRelativeDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else groupedMessages.push({ date, messages: [msg] });
  }

  const otherStatus = effectiveStatus({
    connected: presence[otherUser.id] ?? false,
    chosenStatus: statuses[otherUser.id]?.status,
  });
  const isOtherOnline = isShownOnline(otherStatus);
  const statusLabel = otherStatus === "DND" ? "Do Not Disturb" : otherStatus === "IDLE" ? "Idle" : isOtherOnline ? "Online" : "Offline";

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-dc-chat">
      {/* Header */}
      <div className="h-12 border-b border-dc-border flex items-center px-4 gap-3 shrink-0 bg-dc-chat">
        <Avatar user={otherUser} size="sm" online={isOtherOnline} status={otherStatus} />
        <div className="flex-1 min-w-0">
          <p className="text-dc-text font-semibold text-sm">{otherUser.displayName}</p>
          <p className="text-dc-muted text-xs">{statusLabel}</p>
        </div>
        {!inCall && (
          <div className="flex items-center gap-1">
            <button onClick={() => startCall(false)} className="w-8 h-8 flex items-center justify-center rounded text-dc-muted hover:text-dc-text hover:bg-dc-hover" title="Start voice call">📞</button>
            <button onClick={() => startCall(true)} className="w-8 h-8 flex items-center justify-center rounded text-dc-muted hover:text-dc-text hover:bg-dc-hover" title="Start video call">📹</button>
          </div>
        )}
      </div>

      {/* Incoming call banner */}
      {incoming && !inCall && (
        <div className="flex items-center justify-between gap-3 bg-dc-accent/15 border-b border-dc-accent/30 px-4 py-2">
          <span className="text-sm text-dc-text">
            📞 <span className="font-semibold">{incoming.from.displayName}</span> is calling{incoming.withVideo ? " (video)" : ""}…
          </span>
          <span className="flex gap-2">
            <button onClick={acceptCall} className="rounded bg-dc-success px-3 py-1 text-xs font-semibold text-white">Join</button>
            <button onClick={() => setIncoming(null)} className="rounded bg-dc-hover px-3 py-1 text-xs font-semibold text-dc-text">Dismiss</button>
          </span>
        </div>
      )}

      {inCall && (
        <CallPanel
          threadId={thread.id}
          currentUser={currentUser}
          startWithVideo={callWithVideo}
          onClose={() => { setInCall(false); socket?.emit("dm:call:cancel", { threadId: thread.id, participantIds }); }}
        />
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-dc-accent hover:text-dc-accent-hover disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Avatar user={otherUser} size="lg" className="mb-4" />
            <h3 className="text-dc-text text-xl font-bold mb-1">{otherUser.displayName}</h3>
            <p className="text-dc-muted text-sm">This is the beginning of your direct message history with <span className="text-dc-text font-medium">@{otherUser.username}</span>.</p>
          </div>
        )}

        {groupedMessages.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-dc-border" />
              <span className="text-dc-muted text-xs font-semibold">{date}</span>
              <div className="flex-1 h-px bg-dc-border" />
            </div>
            {dayMsgs.map((msg, i) => {
              const prev = dayMsgs[i - 1];
              const isConsecutive = prev && prev.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

              return (
                <div key={msg.id} className={`flex gap-3 group hover:bg-white/[0.02] rounded px-2 py-0.5 ${isConsecutive ? "mt-0.5" : "mt-3"}`}>
                  {isConsecutive ? (
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <span className="text-dc-faint text-xs opacity-0 group-hover:opacity-100">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  ) : (
                    <Avatar user={msg.sender} size="sm" className="mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {!isConsecutive && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-dc-text text-sm">{msg.sender.displayName}</span>
                        <span className="text-dc-faint text-xs">{formatTime(msg.createdAt)}</span>
                      </div>
                    )}
                    {msg.deleted ? (
                      <p className="text-dc-faint text-sm italic">Message deleted</p>
                    ) : (
                      <p className="text-dc-text text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.edited && !msg.deleted && (
                      <span className="text-dc-faint text-xs ml-1">(edited)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          channelId={thread.id}
          channelName={otherUser.displayName}
          onSend={sendMessage}
          socket={socket}
          isDM={true}
        />
      </div>
    </div>
  );
}
