"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Channel } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  serverId: string;
  onCreated: (channel: Channel) => void;
}

export function CreateChannelModal({ open, onClose, serverId, onCreated }: Props) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"TEXT" | "VOICE">("TEXT");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug, description: description.trim() || null, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to create channel", "error");
        return;
      }
      addToast(`${type === "VOICE" ? "🔊" : "#"}${data.channel.name} created!`, "success");
      onCreated(data.channel);
      setName("");
      setDescription("");
      setType("TEXT");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return (
    <Modal open={open} onClose={onClose} title="Create Channel">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
            Channel Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["TEXT", "VOICE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  type === t
                    ? "border-dc-accent bg-dc-accent/10 text-dc-text"
                    : "border-dc-border bg-dc-input text-dc-muted hover:text-dc-text"
                }`}
              >
                <span className="text-base">{t === "TEXT" ? "#" : "🔊"}</span>
                {t === "TEXT" ? "Text" : "Voice"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
            Channel Name <span className="text-dc-danger">*</span>
          </label>
          <div className="flex items-center bg-dc-input rounded border border-dc-border focus-within:border-dc-accent">
            <span className="pl-3 text-dc-muted font-bold">{type === "VOICE" ? "🔊" : "#"}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 bg-transparent text-dc-text px-2 py-2 focus:outline-none text-sm"
              placeholder="new-channel"
            />
          </div>
          {slug && slug !== name.trim() && (
            <p className="text-dc-muted text-xs mt-1">Will be created as: #{slug}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
            Topic (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={256}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
            placeholder="What's this channel about?"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !slug}
            className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
          >
            {loading ? "Creating…" : "Create Channel"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
