"use client";

import { MessageItem } from "./MessageItem";
import { formatRelativeDate } from "@/lib/dateTime";
import type { Message } from "@/types";

interface Props {
  messages: Message[];
  currentUserId: string;
  canManage: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReaction: (messageId: string, emoji: string, hasReacted: boolean) => Promise<void>;
  onReply: (message: Message) => void;
  onTogglePin: (messageId: string, isPinned: boolean) => Promise<void>;
  onCreateThread?: (message: Message) => void;
  pinnedMessageIds: Set<string>;
  firstUnreadId?: string | null;
}

export function MessageList({
  messages,
  currentUserId,
  canManage,
  onEdit,
  onDelete,
  onReaction,
  onReply,
  onTogglePin,
  onCreateThread,
  pinnedMessageIds,
  firstUnreadId,
}: Props) {
  if (messages.length === 0) return null;

  // Group by date
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = formatRelativeDate(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groups.push({ date, msgs: [msg] });
  }

  return (
    <div className="pb-2">
      {groups.map(({ date, msgs }) => (
        <div key={date}>
          {/* Date divider */}
          <div className="flex items-center gap-3 px-4 my-4">
            <div className="flex-1 h-px bg-dc-border" />
            <span className="text-dc-muted text-xs font-semibold whitespace-nowrap">{date}</span>
            <div className="flex-1 h-px bg-dc-border" />
          </div>

          {msgs.map((msg, i) => {
            const prev = msgs[i - 1];
            const isConsecutive =
              prev &&
              !prev.deleted &&
              prev.userId === msg.userId &&
              prev.botId === msg.botId &&
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

            return (
              <div key={msg.id}>
                {firstUnreadId === msg.id && (
                  <div className="flex items-center gap-2 px-4 my-1">
                    <div className="flex-1 h-px bg-dc-danger/60" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-danger">New</span>
                  </div>
                )}
                <MessageItem
                  message={msg}
                  isConsecutive={(isConsecutive ?? false) && firstUnreadId !== msg.id}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReaction={onReaction}
                  onReply={onReply}
                  onTogglePin={onTogglePin}
                  onCreateThread={onCreateThread}
                  isPinned={pinnedMessageIds.has(msg.id)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
