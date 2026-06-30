"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { Attachment, Message } from "@/types";
import { useToast } from "@/contexts/ToastContext";

interface MemberOption {
  username: string;
  displayName: string;
}

interface Props {
  channelId: string;
  channelName: string;
  onSend: (content: string, attachments: Attachment[]) => Promise<void>;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  socket: Socket | null;
  isDM: boolean;
  slowmodeSeconds?: number;
  isManager?: boolean;
  serverId?: string;
}

const QUICK_EMOJIS = ["😀", "😂", "❤️", "👍", "🎉", "🔥", "💸", "✨", "🤔", "😎", "🚀", "💯"];

interface Staged {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  meta?: Attachment;
}

function getReplyAuthor(message: Message) {
  return message.user?.displayName ?? message.bot?.name ?? "Unknown User";
}

export function MessageInput({
  channelId,
  channelName,
  onSend,
  replyTo,
  onCancelReply,
  socket,
  isDM,
  slowmodeSeconds = 0,
  isManager = false,
  serverId,
}: Props) {
  const { addToast } = useToast();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [members, setMembers] = useState<MemberOption[] | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [content]);

  // Slowmode countdown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function emitTypingStart() {
    if (!socket || isTypingRef.current) return;
    isTypingRef.current = true;
    socket.emit(isDM ? "dm:typing:start" : "typing:start", { [isDM ? "threadId" : "channelId"]: channelId });
  }
  function emitTypingStop() {
    if (!socket || !isTypingRef.current) return;
    isTypingRef.current = false;
    socket.emit(isDM ? "dm:typing:stop" : "typing:stop", { [isDM ? "threadId" : "channelId"]: channelId });
  }

  // Mention autocomplete: detect a trailing "@partial" at the caret.
  const updateMention = useCallback(
    (value: string, caret: number) => {
      const before = value.slice(0, caret);
      const match = before.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
      if (match && !isDM) {
        setMentionQuery(match[1].toLowerCase());
        if (members === null && serverId) {
          fetch(`/api/servers/${serverId}/members`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setMembers((d?.members ?? []).map((m: any) => ({ username: m.user.username, displayName: m.user.displayName }))))
            .catch(() => setMembers([]));
        }
      } else {
        setMentionQuery(null);
      }
    },
    [isDM, members, serverId]
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    updateMention(value, e.target.selectionStart ?? value.length);
    if (value.trim()) {
      emitTypingStart();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(emitTypingStop, 2500);
    } else {
      emitTypingStop();
    }
  }

  function applyMention(username: string) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? content.length;
    const before = content.slice(0, caret).replace(/@([a-zA-Z0-9_.-]{0,32})$/, `@${username} `);
    const after = content.slice(caret);
    const next = before + after;
    setContent(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = before.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 10);
    for (const file of list) {
      const id = `${Date.now()}_${Math.round(file.size)}_${file.name}`;
      setStaged((prev) => [...prev, { id, name: file.name, status: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (serverId) fd.append("serverId", serverId);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        // Capture image dimensions if it's an image.
        let width: number | undefined, height: number | undefined;
        if (data.contentType?.startsWith("image/")) {
          try {
            const dims = await imageSize(data.url);
            width = dims.width;
            height = dims.height;
          } catch {}
        }
        setStaged((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "done", meta: { ...data, width, height } } : s))
        );
      } catch (err: any) {
        addToast(err.message || "Upload failed", "error");
        setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, status: "error" } : s)));
      }
    }
  }

  function imageSize(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    const ready = staged.filter((s) => s.status === "done" && s.meta).map((s) => s.meta!) as Attachment[];
    if ((!trimmed && ready.length === 0) || sending || cooldown > 0) return;
    if (staged.some((s) => s.status === "uploading")) {
      addToast("Wait for uploads to finish.", "info");
      return;
    }

    emitTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setSending(true);
    setContent("");
    setStaged([]);
    setMentionQuery(null);
    try {
      await onSend(trimmed, ready);
      if (slowmodeSeconds > 0 && !isManager) setCooldown(slowmodeSeconds);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionQuery !== null && filteredMembers.length > 0 && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
      e.preventDefault();
      applyMention(filteredMembers[0].username);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      uploadFiles(e.dataTransfer.files);
    }
  }

  const filteredMembers = (members ?? [])
    .filter((m) => mentionQuery === "" || m.username.toLowerCase().includes(mentionQuery ?? "") || m.displayName.toLowerCase().includes(mentionQuery ?? ""))
    .slice(0, 6);

  const disabled = sending || cooldown > 0;

  return (
    <div className="px-4 pb-4" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {replyTo && (
        <div className="flex items-center justify-between bg-dc-input/50 rounded-t-lg px-3 py-2 border border-dc-border border-b-0 text-xs text-dc-muted">
          <span>
            ↩ Replying to <span className="font-semibold text-dc-text">{getReplyAuthor(replyTo)}</span>
            <span className="ml-2 truncate max-w-xs inline-block align-bottom">{replyTo.content}</span>
          </span>
          <button onClick={onCancelReply} className="text-dc-muted hover:text-dc-text ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Staged attachments */}
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-2 bg-dc-input/50 rounded-t-lg px-3 py-2 border border-dc-border border-b-0">
          {staged.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded bg-dc-sidebar px-2 py-1 text-xs text-dc-text">
              {s.meta?.contentType?.startsWith("image/") && (
                <img src={s.meta.url} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="max-w-[10rem] truncate">{s.name}</span>
              <span className="text-dc-faint">
                {s.status === "uploading" ? "…" : s.status === "error" ? "✗" : ""}
              </span>
              <button onClick={() => removeStaged(s.id)} className="text-dc-muted hover:text-dc-danger">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className={`relative flex items-end gap-2 bg-dc-input rounded-lg border border-dc-border focus-within:border-dc-accent/50 transition-colors ${replyTo || staged.length > 0 ? "rounded-t-none" : ""}`}>
        {/* Mention autocomplete */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 z-50 bg-dc-sidebar border border-dc-border rounded-lg shadow-xl overflow-hidden">
            {filteredMembers.map((m, i) => (
              <button
                key={m.username}
                onClick={() => applyMention(m.username)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-dc-hover ${i === 0 ? "bg-dc-hover/50" : ""}`}
              >
                <span className="font-semibold text-dc-text">{m.displayName}</span>
                <span className="text-dc-muted text-xs">@{m.username}</span>
              </button>
            ))}
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-dc-muted hover:text-dc-text transition-colors"
          title="Attach a file"
          type="button"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />

        {/* Emoji */}
        <div className="relative">
          <button onClick={() => setShowEmoji((p) => !p)} className="p-3 text-dc-muted hover:text-dc-text transition-colors text-xl leading-none" title="Emoji" type="button">😊</button>
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
              <div className="absolute bottom-12 left-0 z-50 bg-dc-sidebar border border-dc-border rounded-lg shadow-xl p-2 w-44">
                <div className="grid grid-cols-6 gap-1">
                  {QUICK_EMOJIS.map((e) => (
                    <button key={e} onClick={() => { setContent((p) => p + e); setShowEmoji(false); textareaRef.current?.focus(); }} className="text-lg hover:bg-dc-hover rounded p-1 transition-colors" type="button">{e}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={cooldown > 0 ? `Slowmode — wait ${cooldown}s` : `Message #${channelName}`}
          disabled={sending}
          rows={1}
          className="flex-1 bg-transparent text-dc-text text-sm py-3 resize-none focus:outline-none placeholder-dc-faint min-h-[44px] max-h-60"
        />

        <button
          onClick={handleSubmit}
          disabled={disabled || (!content.trim() && staged.filter((s) => s.status === "done").length === 0)}
          className="p-3 text-dc-muted hover:text-dc-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Send message"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>

      <p className="text-dc-faint text-xs mt-1 px-1">
        {cooldown > 0 ? (
          <span className="text-dc-warning">Slowmode active — {cooldown}s remaining</span>
        ) : (
          <>
            <kbd className="bg-dc-hover px-1 rounded text-xs">Enter</kbd> to send ·{" "}
            <kbd className="bg-dc-hover px-1 rounded text-xs">Shift+Enter</kbd> for new line · drag, paste, or 📎 to attach
          </>
        )}
      </p>
    </div>
  );
}
