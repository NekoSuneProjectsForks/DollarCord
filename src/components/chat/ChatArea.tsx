"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChannelHeader } from "./ChannelHeader";
import { TypingIndicator } from "./TypingIndicator";
import { ThreadPanel } from "./ThreadPanel";
import type { Attachment, Channel, Message, User, TypingUser, MemberRole } from "@/types";

interface Props {
  channel: Channel & { server: { name: string } };
  currentUser: User;
  currentUserRole: MemberRole;
  initialMessages: Message[];
  pinnedMessages: Message[];
}

export function ChatArea({ channel, currentUser, currentUserRole, initialMessages, pinnedMessages }: Props) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [pins, setPins] = useState<Message[]>(pinnedMessages);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [hasMore, setHasMore] = useState(initialMessages.length === 50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [threadSeed, setThreadSeed] = useState<Message | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [threadUnread, setThreadUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Count threads with unread activity (for the header 🧵 badge).
  const refreshThreadUnread = useCallback(() => {
    fetch(`/api/channels/${channel.id}/threads`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setThreadUnread((d?.threads ?? []).filter((t: { unread?: boolean }) => t.unread).length))
      .catch(() => {});
  }, [channel.id]);

  function openThreadFromMessage(message: Message) {
    setThreadSeed(message);
    setThreadsOpen(true);
  }

  // Refresh the thread-unread count on channel change and when the panel closes
  // (the panel marks threads read), plus react to live thread activity.
  useEffect(() => { refreshThreadUnread(); }, [refreshThreadUnread]);
  useEffect(() => { if (!threadsOpen) refreshThreadUnread(); }, [threadsOpen, refreshThreadUnread]);
  useEffect(() => {
    if (!socket) return;
    const onThreadActivity = ({ channelId: ch, authorId }: { channelId: string; authorId: string }) => {
      if (ch !== channel.id || authorId === currentUser.id || threadsOpen) return;
      setThreadUnread((c) => c + 1);
    };
    socket.on("channel:thread:activity", onThreadActivity);
    return () => { socket.off("channel:thread:activity", onThreadActivity); };
  }, [socket, channel.id, currentUser.id, threadsOpen]);

  useEffect(() => {
    setMessages(initialMessages);
    setPins(pinnedMessages);
    setHasMore(initialMessages.length === 50);
    setTypingUsers([]);
    setReplyTo(null);
  }, [channel.id, initialMessages, pinnedMessages]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  const refreshPins = useCallback(async () => {
    const res = await fetch(`/api/channels/${channel.id}/pins`);
    if (!res.ok) return;
    const data = await res.json();
    setPins(data.pins ?? []);
  }, [channel.id]);

  // Mark the channel read when opened and whenever new messages arrive while
  // it's the active view (clears the sidebar unread/mention badge).
  const markRead = useCallback(() => {
    fetch(`/api/channels/${channel.id}/read`, { method: "POST" }).catch(() => {});
    socket?.emit("channel:read", { channelId: channel.id });
  }, [channel.id, socket]);

  // Compute the "new messages" boundary from the saved read state BEFORE marking
  // the channel read, so the divider survives this visit.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/channels/${channel.id}/read`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const lastReadAt = d?.lastReadAt ? new Date(d.lastReadAt).getTime() : 0;
        const firstUnread = initialMessages.find(
          (m) => m.userId !== currentUser.id && new Date(m.createdAt).getTime() > lastReadAt
        );
        setFirstUnreadId(firstUnread?.id ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) markRead(); });
    return () => { cancelled = true; };
  }, [channel.id, initialMessages, currentUser.id, markRead]);

  useEffect(() => { scrollToBottom(); }, [channel.id, scrollToBottom]);
  useEffect(() => {
    // Scroll to bottom when new messages arrive (if already near bottom)
    if (listRef.current) {
      const el = listRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (isNearBottom) scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Socket subscriptions
  useEffect(() => {
    if (!socket) return;

    socket.emit("channel:join", channel.id);

    socket.on("channel:message", (msg: Message) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // We're actively viewing this channel, so keep it marked read.
      markRead();
    });

    socket.on("channel:message:update", (msg: Message) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      setPins((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });

    socket.on("channel:message:delete", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setPins((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on("channel:pins:update", () => {
      refreshPins();
    });

    socket.on("typing:start", (data: TypingUser & { channelId: string }) => {
      if (data.channelId !== channel.id || data.userId === currentUser.id) return;
      setTypingUsers((prev) => {
        if (prev.find((u) => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username, displayName: data.displayName }];
      });
    });

    socket.on("typing:stop", ({ channelId, userId }: { channelId: string; userId: string }) => {
      if (channelId !== channel.id) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    return () => {
      socket.emit("channel:leave", channel.id);
      socket.off("channel:message");
      socket.off("channel:message:update");
      socket.off("channel:message:delete");
      socket.off("channel:pins:update");
      socket.off("typing:start");
      socket.off("typing:stop");
    };
  }, [socket, channel.id, currentUser.id, refreshPins, markRead]);

  async function sendMessage(content: string, attachments: Attachment[] = []) {
    const res = await fetch(`/api/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, replyToId: replyTo?.id ?? null, attachments }),
    });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Failed to send message", "error");
    } else {
      setReplyTo(null);
    }
  }

  async function editMessage(messageId: string, content: string) {
    const res = await fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Edit failed", "error");
    }
  }

  async function deleteMessage(messageId: string) {
    const res = await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Delete failed", "error");
    }
  }

  async function toggleReaction(messageId: string, emoji: string, hasReacted: boolean) {
    if (hasReacted) {
      await fetch(`/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: "DELETE" });
    } else {
      await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    }
  }

  async function togglePin(messageId: string, isPinned: boolean) {
    const res = await fetch(
      isPinned
        ? `/api/channels/${channel.id}/pins?messageId=${encodeURIComponent(messageId)}`
        : `/api/channels/${channel.id}/pins`,
      {
        method: isPinned ? "DELETE" : "POST",
        headers: isPinned ? undefined : { "Content-Type": "application/json" },
        body: isPinned ? undefined : JSON.stringify({ messageId }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      addToast(data.error || "Failed to update pinned message", "error");
      return;
    }

    refreshPins();
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const cursor = messages[0]?.createdAt;
    const res = await fetch(
      `/api/channels/${channel.id}/messages?cursor=${encodeURIComponent(String(cursor))}&limit=50`
    );
    const data = await res.json();
    setMessages((prev) => [...(data.messages ?? []), ...prev]);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }

  const displayMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const canManage = ["OWNER", "ADMIN"].includes(currentUserRole);
  const pinnedMessageIds = new Set(pins.map((message) => message.id));
  const [nsfwConfirmed, setNsfwConfirmed] = useState(false);
  useEffect(() => { setNsfwConfirmed(false); }, [channel.id]);

  if (channel.nsfw && !nsfwConfirmed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-dc-chat px-8 text-center">
        <div className="text-5xl mb-4">🔞</div>
        <h2 className="text-dc-text text-xl font-bold mb-2">#{channel.name}</h2>
        <p className="text-dc-muted text-sm max-w-sm mb-5">
          This is an age-restricted channel. Please confirm you are at least 18 years old and want to view its content.
        </p>
        <button
          onClick={() => setNsfwConfirmed(true)}
          className="rounded bg-dc-accent px-6 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover"
        >
          I&apos;m over 18 — continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
    <div className="relative flex flex-col flex-1 overflow-hidden bg-dc-chat">
      <ChannelHeader
        channel={channel}
        pinnedMessages={pins}
        canManage={canManage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleThreads={() => { setThreadSeed(null); setThreadsOpen((o) => !o); }}
        threadUnread={threadUnread}
      />

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
        }}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {hasMore && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-dc-accent hover:text-dc-accent-hover disabled:opacity-50 transition-colors"
            >
              {loadingMore ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {!searchQuery && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">#</div>
            <h3 className="text-dc-text text-xl font-bold mb-2">Welcome to #{channel.name}!</h3>
            <p className="text-dc-muted text-sm">This is the start of the #{channel.name} channel.</p>
          </div>
        )}

        {searchQuery && displayMessages.length === 0 && (
          <div className="text-center text-dc-muted text-sm py-12">No messages match "{searchQuery}"</div>
        )}

        <MessageList
          messages={displayMessages}
          currentUserId={currentUser.id}
          canManage={canManage}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onReaction={toggleReaction}
          onReply={setReplyTo}
          onTogglePin={togglePin}
          onCreateThread={openThreadFromMessage}
          pinnedMessageIds={pinnedMessageIds}
          firstUnreadId={firstUnreadId}
        />
      </div>

      {showJump && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 z-10 rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-dc-accent-hover"
        >
          Jump to present ↓
        </button>
      )}

      <div className="shrink-0">
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          channelId={channel.id}
          channelName={channel.name}
          onSend={sendMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          socket={socket}
          isDM={false}
          slowmodeSeconds={channel.slowmodeSeconds ?? 0}
          isManager={canManage}
          serverId={channel.serverId}
        />
      </div>
    </div>

    {threadsOpen && (
      <ThreadPanel
        channelId={channel.id}
        serverId={channel.serverId}
        currentUser={currentUser}
        seedFromMessage={threadSeed}
        onClose={() => { setThreadsOpen(false); setThreadSeed(null); }}
      />
    )}
    </div>
  );
}
