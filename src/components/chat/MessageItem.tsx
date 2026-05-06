"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatTime } from "@/lib/dateTime";
import { extractMessageEmbeds } from "@/lib/messageEmbeds";
import type { Message, Reaction } from "@/types";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "💸"];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const cleanUrl = url.replace(/[.,!?;:]+$/, "");
    const suffix = url.slice(cleanUrl.length);
    const href = cleanUrl.replace(/&quot;/g, "%22");
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${suffix}`;
  });
}

/** Minimal markdown renderer: **bold**, *italic*, `code`, ~~strike~~, > blockquote, ```codeblock``` */
function renderMarkdown(text: string): string {
  return linkifyUrls(
    escapeHtml(text)
      .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/\n/g, "<br/>")
  );
}

function groupReactions(reactions: Reaction[], currentUserId: string) {
  const groups = new Map<string, { count: number; hasReacted: boolean }>();
  for (const r of reactions) {
    const existing = groups.get(r.emoji) ?? { count: 0, hasReacted: false };
    groups.set(r.emoji, {
      count: existing.count + 1,
      hasReacted: existing.hasReacted || r.userId === currentUserId,
    });
  }
  return Array.from(groups.entries()).map(([emoji, data]) => ({ emoji, ...data }));
}

function getAuthor(message: Message) {
  if (message.user) return { ...message.user, isBot: false };
  if (message.bot) {
    return {
      displayName: message.bot.name,
      username: message.bot.username,
      avatarUrl: message.bot.avatarUrl,
      isBot: true,
    };
  }
  return { displayName: "Unknown User", username: "unknown", avatarUrl: null, isBot: false };
}

interface Props {
  message: Message;
  isConsecutive: boolean;
  currentUserId: string;
  canManage: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReaction: (messageId: string, emoji: string, hasReacted: boolean) => Promise<void>;
  onReply: (message: Message) => void;
  onTogglePin: (messageId: string, isPinned: boolean) => Promise<void>;
  isPinned: boolean;
}

export function MessageItem({
  message,
  isConsecutive,
  currentUserId,
  canManage,
  onEdit,
  onDelete,
  onReaction,
  onReply,
  onTogglePin,
  isPinned,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isOwn = message.userId === currentUserId;
  const canEdit = isOwn && !message.deleted;
  const canDelete = (isOwn || canManage) && !message.deleted;
  const author = getAuthor(message);
  const embeds = message.deleted ? [] : extractMessageEmbeds(message.content);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [editing]);

  async function submitEdit() {
    if (editContent.trim() === message.content || !editContent.trim()) {
      setEditing(false);
      setEditContent(message.content);
      return;
    }
    await onEdit(message.id, editContent.trim());
    setEditing(false);
  }

  const reactions = groupReactions(message.reactions ?? [], currentUserId);

  return (
    <div
      className="group relative flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] rounded"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Reply preview */}
      {message.replyTo && !message.deleted && (
        <div className="absolute top-0 left-16 flex items-center gap-1 text-xs text-dc-muted -translate-y-full py-1">
          <span>↩</span>
          <span className="font-medium text-dc-text">{getAuthor(message.replyTo).displayName}</span>
          <span className="truncate max-w-48">{message.replyTo.content}</span>
        </div>
      )}

      {/* Avatar column */}
      {isConsecutive ? (
        <div className="w-10 shrink-0 flex items-center justify-center mt-0.5">
          {showActions && (
            <span className="text-dc-faint text-xs">
              {formatTime(message.createdAt)}
            </span>
          )}
        </div>
      ) : (
        <Avatar user={author} size="sm" className="mt-1 shrink-0" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + timestamp (only for first in group) */}
        {!isConsecutive && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-dc-text text-sm">{author.displayName}</span>
            {author.isBot && (
              <span className="rounded bg-dc-accent px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                BOT
              </span>
            )}
            <span className="text-dc-faint text-xs">{formatTime(message.createdAt)}</span>
            {message.edited && <span className="text-dc-faint text-xs">(edited)</span>}
            {isPinned && <span className="text-dc-accent text-xs font-semibold">Pinned</span>}
          </div>
        )}

        {/* Message content */}
        {message.deleted ? (
          <p className="text-dc-faint text-sm italic">Message deleted</p>
        ) : editing ? (
          <div>
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                if (e.key === "Escape") { setEditing(false); setEditContent(message.content); }
              }}
              className="w-full bg-dc-input text-dc-text text-sm px-3 py-2 rounded border border-dc-accent focus:outline-none resize-none"
              rows={Math.min(editContent.split("\n").length + 1, 10)}
            />
            <p className="text-dc-muted text-xs mt-1">
              <kbd>Enter</kbd> to save · <kbd>Esc</kbd> to cancel
            </p>
          </div>
        ) : (
          <div
            className="message-content text-sm text-dc-text break-words"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}

        {embeds.length > 0 && (
          <div className="mt-2 space-y-2 max-w-xl">
            {embeds.map((embed) => (
              <div
                key={embed.url}
                className="overflow-hidden rounded border border-dc-border bg-dc-sidebar"
                style={{ borderLeftColor: embed.color, borderLeftWidth: 4 }}
              >
                <div className="p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">{embed.providerName}</p>
                  <a
                    href={embed.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm font-semibold text-dc-text hover:underline"
                  >
                    {embed.title}
                  </a>
                  {embed.description && (
                    <p className="mt-1 break-all text-xs text-dc-muted">{embed.description}</p>
                  )}
                  <a
                    href={embed.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex rounded bg-dc-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-dc-accent-hover transition-colors"
                  >
                    {embed.actionLabel}
                  </a>
                </div>
                {embed.thumbnailUrl && (
                  <a href={embed.actionUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={embed.thumbnailUrl} alt="" className="max-h-72 w-full object-cover" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map(({ emoji, count, hasReacted }) => (
              <button
                key={emoji}
                onClick={() => onReaction(message.id, emoji, hasReacted)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
                  hasReacted
                    ? "bg-dc-accent-dim border-dc-accent text-dc-accent"
                    : "bg-dc-hover border-dc-border text-dc-muted hover:border-dc-accent"
                }`}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action toolbar */}
      {showActions && !message.deleted && !editing && (
        <div className="absolute -top-4 right-4 flex items-center bg-dc-sidebar border border-dc-border rounded-lg shadow-lg overflow-hidden">
          {/* Quick emoji reactions */}
          {!showEmojiPicker && QUICK_EMOJIS.map((emoji) => {
            const hasReacted = (message.reactions ?? []).some(
              (r) => r.emoji === emoji && r.userId === currentUserId
            );
            return (
              <button
                key={emoji}
                onClick={() => onReaction(message.id, emoji, hasReacted)}
                className="px-2 py-1 text-sm hover:bg-dc-hover transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            );
          })}

          <div className="w-px h-4 bg-dc-border mx-0.5" />

          {/* Reply */}
          <button
            onClick={() => onReply(message)}
            className="px-2 py-1 text-dc-muted hover:text-dc-text hover:bg-dc-hover transition-colors text-sm"
            title="Reply"
          >
            ↩
          </button>

          {/* Edit (own messages only) */}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 text-dc-muted hover:text-dc-text hover:bg-dc-hover transition-colors text-sm"
              title="Edit"
            >
              ✏
            </button>
          )}

          {canManage && (
            <button
              onClick={() => onTogglePin(message.id, isPinned)}
              className="px-2 py-1 text-dc-muted hover:text-dc-text hover:bg-dc-hover transition-colors text-xs"
              title={isPinned ? "Unpin" : "Pin"}
            >
              {isPinned ? "Unpin" : "Pin"}
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="px-2 py-1 text-dc-muted hover:text-dc-danger hover:bg-dc-hover transition-colors text-sm"
              title="Delete"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </div>
  );
}
