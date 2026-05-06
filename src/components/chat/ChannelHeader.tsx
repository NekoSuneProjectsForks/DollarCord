"use client";

import { useState } from "react";
import type { Channel, Message } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate } from "@/lib/dateTime";

interface Props {
  channel: Channel & { server: { name: string } };
  pinnedMessages: Message[];
  canManage: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function getAuthorName(message: Message) {
  return message.user?.displayName ?? message.bot?.name ?? "Unknown User";
}

export function ChannelHeader({ channel, pinnedMessages, canManage, searchQuery, onSearchChange }: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [showPins, setShowPins] = useState(false);

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

          {/* Pinned messages */}
          <button
            onClick={() => setShowPins(true)}
            className="w-8 h-8 flex items-center justify-center text-dc-muted hover:text-dc-text hover:bg-dc-hover rounded transition-colors"
            title="Pinned messages"
          >
            📌
          </button>
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
