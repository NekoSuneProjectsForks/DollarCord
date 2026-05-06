"use client";

import { useState, useRef, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { Message } from "@/types";
import { Avatar } from "@/components/ui/Avatar";

interface Props {
  channelId: string;
  channelName: string;
  onSend: (content: string) => Promise<void>;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  socket: Socket | null;
  isDM: boolean;
}

const QUICK_EMOJIS = ["😀", "😂", "❤️", "👍", "🎉", "🔥", "💸", "✨", "🤔", "😎", "🚀", "💯"];

function getReplyAuthor(message: Message) {
  return message.user?.displayName ?? message.bot?.name ?? "Unknown User";
}

export function MessageInput({ channelId, channelName, onSend, replyTo, onCancelReply, socket, isDM }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [content]);

  function emitTypingStart() {
    if (!socket || isTypingRef.current) return;
    isTypingRef.current = true;
    const event = isDM ? "dm:typing:start" : "typing:start";
    const key = isDM ? "threadId" : "channelId";
    socket.emit(event, { [key]: channelId });
  }

  function emitTypingStop() {
    if (!socket || !isTypingRef.current) return;
    isTypingRef.current = false;
    const event = isDM ? "dm:typing:stop" : "typing:stop";
    const key = isDM ? "threadId" : "channelId";
    socket.emit(event, { [key]: channelId });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    if (e.target.value.trim()) {
      emitTypingStart();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(emitTypingStop, 2500);
    } else {
      emitTypingStop();
    }
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    emitTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setSending(true);
    setContent("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function insertEmoji(emoji: string) {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="px-4 pb-4">
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center justify-between bg-dc-input/50 rounded-t-lg px-3 py-2 border border-dc-border border-b-0 text-xs text-dc-muted">
          <span>
            ↩ Replying to{" "}
            <span className="font-semibold text-dc-text">{getReplyAuthor(replyTo)}</span>
            <span className="ml-2 truncate max-w-xs inline-block align-bottom">{replyTo.content}</span>
          </span>
          <button
            onClick={onCancelReply}
            className="text-dc-muted hover:text-dc-text ml-2 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className={`flex items-end gap-2 bg-dc-input rounded-lg border border-dc-border focus-within:border-dc-accent/50 transition-colors ${replyTo ? "rounded-t-none" : ""}`}>
        {/* Emoji picker button */}
        <div className="relative">
          <button
            onClick={() => setShowEmoji((p) => !p)}
            className="p-3 text-dc-muted hover:text-dc-text transition-colors text-xl leading-none"
            title="Emoji"
          >
            😊
          </button>

          {showEmoji && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
              <div className="absolute bottom-12 left-0 z-50 bg-dc-sidebar border border-dc-border rounded-lg shadow-xl p-2 w-44">
                <div className="grid grid-cols-6 gap-1">
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => insertEmoji(e)}
                      className="text-lg hover:bg-dc-hover rounded p-1 transition-colors"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          disabled={sending}
          rows={1}
          className="flex-1 bg-transparent text-dc-text text-sm py-3 resize-none focus:outline-none placeholder-dc-faint min-h-[44px] max-h-60"
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || sending}
          className="p-3 text-dc-muted hover:text-dc-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Send message"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <p className="text-dc-faint text-xs mt-1 px-1">
        <kbd className="bg-dc-hover px-1 rounded text-xs">Enter</kbd> to send ·{" "}
        <kbd className="bg-dc-hover px-1 rounded text-xs">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
