"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Channel, ServerEvent } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  serverId: string;
  channels: Channel[];
  onCreated: (event: ServerEvent) => void;
}

function toLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CreateEventModal({ open, onClose, serverId, channels, onCreated }: Props) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    channelId: "",
    startsAt: toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
    endsAt: "",
  });
  const [creating, setCreating] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          channelId: form.channelId || null,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to create event", "error");
        return;
      }
      onCreated(data.event);
      addToast("Event created.", "success");
      setForm({
        title: "",
        description: "",
        location: "",
        channelId: "",
        startsAt: toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
        endsAt: "",
      });
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Event" size="lg">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">Event Name</label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={100}
            className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
            placeholder="Movie night"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">Start</label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => update("startsAt", e.target.value)}
              className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">End</label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => update("endsAt", e.target.value)}
              className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">Channel</label>
          <select
            value={form.channelId}
            onChange={(e) => update("channelId", e.target.value)}
            className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
          >
            <option value="">No channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>#{channel.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">Location</label>
          <input
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            maxLength={120}
            className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
            placeholder="Voice chat, game lobby, or link"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full resize-none rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text">Cancel</button>
          <button
            type="submit"
            disabled={creating || !form.title.trim() || !form.startsAt}
            className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
