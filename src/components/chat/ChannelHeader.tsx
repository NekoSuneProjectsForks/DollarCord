"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, Message } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate } from "@/lib/dateTime";

const SLOWMODE_OPTIONS: { label: string; value: number }[] = [
  { label: "Off", value: 0 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
];

interface Props {
  channel: Channel & { server: { name: string } };
  pinnedMessages: Message[];
  canManage: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleThreads?: () => void;
}

function getAuthorName(message: Message) {
  return message.user?.displayName ?? message.bot?.name ?? "Unknown User";
}

export function ChannelHeader({ channel, pinnedMessages, canManage, searchQuery, onSearchChange, onToggleThreads }: Props) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [showSlowmode, setShowSlowmode] = useState(false);

  async function setSlowmode(value: number) {
    setShowSlowmode(false);
    await fetch(`/api/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slowmodeSeconds: value }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="h-12 border-b border-dc-border flex items-center px-4 gap-3 shrink-0 bg-dc-chat">
        {/* Channel name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-dc-muted text-lg font-bold leading-none">#</span>
          <h1 className="text-dc-text font-semibold text-base truncate">{channel.name}</h1>
          {channel.description && (
            <>
              <span className="text-dc-faint text-sm mx-1 shrink-0">|</span>
              <span className="text-dc-muted text-sm truncate">{channel.description}</span>
            </>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Search toggle */}
          {showSearch ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search messages…"
                className="bg-dc-input text-dc-text text-sm px-3 py-1 rounded border border-dc-border focus:border-dc-accent focus:outline-none w-48"
              />
              <button
                onClick={() => { setShowSearch(false); onSearchChange(""); }}
                className="text-dc-muted hover:text-dc-text transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="w-8 h-8 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
              title="Search messages"
            >
              🔍
            </button>
          )}

          {/* Threads */}
          {onToggleThreads && (
            <button
              onClick={onToggleThreads}
              className="w-8 h-8 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
              title="Threads"
            >
              🧵
            </button>
          )}

          {/* Pinned messages */}
          <button
            onClick={() => setShowPins(true)}
            className="w-8 h-8 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
            title="Pinned messages"
          >
            📌
          </button>

          {/* Slowmode (managers) */}
          {canManage && (
            <div className="relative">
              <button
                onClick={() => setShowSlowmode((s) => !s)}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-dc-hover ${
                  channel.slowmodeSeconds ? "text-dc-warning" : "text-dc-muted hover:text-dc-text"
                }`}
                title={channel.slowmodeSeconds ? `Slowmode: ${channel.slowmodeSeconds}s` : "Slowmode"}
              >
                ⏱
              </button>
              {showSlowmode && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSlowmode(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-dc-border bg-dc-rail shadow-xl">
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-dc-faint">Slowmode</p>
                    {SLOWMODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSlowmode(opt.value)}
                        className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-dc-hover ${
                          (channel.slowmodeSeconds ?? 0) === opt.value ? "text-dc-accent" : "text-dc-text"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned messages modal */}
      <Modal open={showPins} onClose={() => setShowPins(false)} title="Pinned Messages">
        {pinnedMessages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📌</div>
            <p className="text-dc-muted text-sm">No pinned messages yet.</p>
            {canManage && <p className="text-dc-muted text-xs mt-1">Hover a message and click an admin action to pin it.</p>}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {pinnedMessages.map((msg) => (
              <div key={msg.id} className="bg-dc-chat rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-dc-text text-sm font-semibold">{getAuthorName(msg)}</span>
                  <span className="text-dc-faint text-xs">
                    {formatShortDate(msg.createdAt)}
                  </span>
                </div>
                <p className="text-dc-text text-sm">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
