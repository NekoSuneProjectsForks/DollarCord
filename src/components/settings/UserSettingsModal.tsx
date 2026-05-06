"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  user: User;
}

export function UserSettingsModal({ open, onClose, user }: Props) {
  const { setUser } = useAuth();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    displayName: user.displayName,
    bio: user.bio ?? "",
    avatarUrl: user.avatarUrl ?? "",
    twitchChannel: user.twitchChannel ?? "",
    kickChannel: user.kickChannel ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName || undefined,
          bio: form.bio || null,
          avatarUrl: form.avatarUrl || null,
          twitchChannel: form.twitchChannel || null,
          kickChannel: form.kickChannel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Update failed", "error");
        return;
      }
      setUser(data.user);
      addToast("Profile updated!", "success");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-dc-border">
        <Avatar user={{ ...user, avatarUrl: form.avatarUrl || null }} size="lg" />
        <div>
          <p className="text-dc-text font-semibold">{form.displayName || user.displayName}</p>
          <div className="flex items-center gap-2">
            <p className="text-dc-muted text-sm">@{user.username}</p>
            {user.isPlatformAdmin && (
              <span className="rounded-full bg-dc-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
                DollarCord Admin
              </span>
            )}
          </div>
        </div>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Display Name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            maxLength={64}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            maxLength={256}
            rows={2}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Avatar URL</label>
          <input
            type="url"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
            placeholder="https://example.com/avatar.png"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Twitch Channel</label>
            <input
              type="text"
              value={form.twitchChannel}
              onChange={(e) => setForm((f) => ({ ...f, twitchChannel: e.target.value }))}
              maxLength={25}
              className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
              placeholder="channelname"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Kick Channel</label>
            <input
              type="text"
              value={form.kickChannel}
              onChange={(e) => setForm((f) => ({ ...f, kickChannel: e.target.value }))}
              maxLength={25}
              className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
              placeholder="channelname"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
