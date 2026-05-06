"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { formatDate } from "@/lib/dateTime";
import type { ServerEvent, ServerEventParticipant } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  serverId: string;
  event: ServerEvent | null;
  canManage: boolean;
  onChanged: (event: ServerEvent | null) => void;
}

export function EventDetailsModal({ open, onClose, serverId, event, canManage, onChanged }: Props) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!event) return null;

  const currentEvent = event;
  const joined = Boolean(currentEvent.currentUserParticipant);

  async function joinEvent() {
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/events/${currentEvent.id}/participants`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to join event", "error");
        return;
      }
      onChanged({ ...currentEvent, currentUserParticipant: data.participant, participantCount: data.participantCount });
    } finally {
      setBusy(false);
    }
  }

  async function leaveEvent() {
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/events/${currentEvent.id}/participants`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to leave event", "error");
        return;
      }
      onChanged({ ...currentEvent, currentUserParticipant: null, participantCount: data.participantCount });
    } finally {
      setBusy(false);
    }
  }

  async function updateNotify(notify: boolean) {
    if (!currentEvent.currentUserParticipant) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/events/${currentEvent.id}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to update event notifications", "error");
        return;
      }
      onChanged({ ...currentEvent, currentUserParticipant: data.participant as ServerEventParticipant });
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent() {
    if (!window.confirm(`Cancel ${currentEvent.title}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/events/${currentEvent.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data.error || "Failed to cancel event", "error");
        return;
      }
      onChanged(null);
      addToast("Event canceled.", "info");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Event" size="md">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-dc-text">{currentEvent.title}</h3>
          <p className="mt-1 text-sm text-dc-muted">{formatDate(currentEvent.startsAt)}</p>
          {currentEvent.channel && <p className="text-sm text-dc-muted">#{currentEvent.channel.name}</p>}
          {currentEvent.location && <p className="text-sm text-dc-muted">{currentEvent.location}</p>}
        </div>

        {currentEvent.description && <p className="whitespace-pre-wrap text-sm text-dc-text">{currentEvent.description}</p>}

        <div className="rounded bg-dc-chat px-3 py-2 text-sm text-dc-muted">
          {currentEvent.participantCount ?? 0} interested
        </div>

        {joined && (
          <label className="flex items-center gap-2 text-sm text-dc-muted">
            <input
              type="checkbox"
              checked={currentEvent.currentUserParticipant?.notify ?? false}
              onChange={(e) => updateNotify(e.target.checked)}
              disabled={busy}
              className="accent-dc-accent"
            />
            Notify me about this event
          </label>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div>
            {canManage && (
              <button
                onClick={cancelEvent}
                disabled={busy}
                className="rounded bg-dc-danger/15 px-4 py-2 text-sm font-semibold text-dc-danger hover:bg-dc-danger/25 disabled:opacity-50"
              >
                Cancel Event
              </button>
            )}
          </div>
          <button
            onClick={joined ? leaveEvent : joinEvent}
            disabled={busy}
            className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              joined ? "bg-dc-hover text-dc-text hover:bg-dc-border" : "bg-dc-accent text-white hover:bg-dc-accent-hover"
            }`}
          >
            {joined ? "Leave Event" : "Join Event"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
