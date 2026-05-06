"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Server, ServerUserSettings } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  server: Server;
}

const defaults: Pick<ServerUserSettings, "allowDms" | "messageRequests" | "shareActivity" | "activityJoining"> = {
  allowDms: true,
  messageRequests: false,
  shareActivity: true,
  activityJoining: true,
};

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-12 rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-dc-accent" : "bg-dc-input"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "left-7" : "left-1"}`} />
    </button>
  );
}

export function ServerPrivacySettingsModal({ open, onClose, server }: Props) {
  const { addToast } = useToast();
  const [settings, setSettings] = useState(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/servers/${server.id}/user-settings`)
      .then((res) => res.json())
      .then((data) => setSettings({ ...defaults, ...(data.settings ?? {}) }));
  }, [open, server.id]);

  async function update(partial: Partial<typeof defaults>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/user-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to save privacy settings", "error");
        setSettings(settings);
        return;
      }
      setSettings({ ...defaults, ...data.settings });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Privacy Settings-${server.name}`} size="md">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-dc-text">Direct Messages</p>
            <p className="mt-1 text-sm text-dc-muted">Allow DMs from other members in this server.</p>
          </div>
          <Toggle checked={settings.allowDms} onChange={(allowDms) => update({ allowDms })} disabled={saving} />
        </div>

        <div className="flex items-start justify-between gap-4 opacity-60">
          <div>
            <p className="font-semibold text-dc-text">Message requests</p>
            <p className="mt-1 text-sm text-dc-muted">Filter messages from server members you may not know.</p>
          </div>
          <Toggle checked={settings.messageRequests} onChange={(messageRequests) => update({ messageRequests })} disabled={saving} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-dc-text">Share my activity</p>
            <p className="mt-1 text-sm text-dc-muted">Share activity information from connected apps in this server.</p>
          </div>
          <Toggle checked={settings.shareActivity} onChange={(shareActivity) => update({ shareActivity })} disabled={saving} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-dc-text">Activity joining</p>
            <p className="mt-1 text-sm text-dc-muted">Allow users to join your activity in this server.</p>
          </div>
          <Toggle checked={settings.activityJoining} onChange={(activityJoining) => update({ activityJoining })} disabled={saving} />
        </div>

        <button
          onClick={onClose}
          className="w-full rounded bg-dc-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-dc-accent-hover transition-colors"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
