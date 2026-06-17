"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChannelHeader } from "./ChannelHeader";
import { TypingIndicator } from "./TypingIndicator";
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
  const listRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { markRead(); }, [channel.id, markRead]);

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

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-dc-chat">
      <ChannelHeader
        channel={channel}
        pinnedMessages={pins}
        canManage={canManage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin">
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
          pinnedMessageIds={pinnedMessageIds}
        />
      </div>

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
  );
}
