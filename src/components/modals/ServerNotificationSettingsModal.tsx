"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Server, ServerNotificationLevel, ServerUserSettings } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  server: Server;
}

type NotificationSettings = Pick<
  ServerUserSettings,
  | "muted"
  | "notificationLevel"
  | "suppressEveryone"
  | "suppressRoleMentions"
  | "suppressHighlights"
  | "muteNewEvents"
  | "mobilePushNotifications"
  | "inAppEventAlerts"
  | "pushEventAlerts"
>;

const defaults: NotificationSettings = {
  muted: false,
  notificationLevel: "ALL_MESSAGES",
  suppressEveryone: false,
  suppressRoleMentions: false,
  suppressHighlights: false,
  muteNewEvents: false,
  mobilePushNotifications: true,
  inAppEventAlerts: true,
  pushEventAlerts: true,
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

export function ServerNotificationSettingsModal({ open, onClose, server }: Props) {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/servers/${server.id}/user-settings`)
      .then((res) => res.json())
      .then((data) => setSettings({ ...defaults, ...(data.settings ?? {}) }));
  }, [open, server.id]);

  async function update(partial: Partial<NotificationSettings>) {
    const previous = settings;
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
        addToast(data.error || "Failed to save notification settings", "error");
        setSettings(previous);
        return;
      }
      setSettings({ ...defaults, ...data.settings });
    } finally {
      setSaving(false);
    }
  }

  const levels: { value: ServerNotificationLevel; label: string }[] = [
    { value: "ALL_MESSAGES", label: "All Messages" },
    { value: "MENTIONS", label: "Only @mentions" },
    { value: "NOTHING", label: "Nothing" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Notification Settings" size="lg">
      <div className="max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
        <div className="flex items-start justify-between gap-4 border-b border-dc-border pb-5">
          <div>
            <p className="font-semibold text-dc-text">Mute {server.name}</p>
            <p className="mt-1 text-sm text-dc-muted">Muting a server prevents unread indicators and notifications from appearing unless you are mentioned.</p>
          </div>
          <Toggle checked={settings.muted} onChange={(muted) => update({ muted })} disabled={saving} />
        </div>

        <div className="border-b border-dc-border py-5">
          <p className="mb-3 font-semibold text-dc-text">Server Notification Settings</p>
          <div className="space-y-3">
            {levels.map((level) => (
              <label key={level.value} className="flex items-center gap-3 text-sm text-dc-text">
                <input
                  type="radio"
                  checked={settings.notificationLevel === level.value}
                  onChange={() => update({ notificationLevel: level.value })}
                  disabled={saving}
                  className="h-4 w-4 accent-dc-accent"
                />
                {level.label}
              </label>
            ))}
          </div>
        </div>

        <div className="border-b border-dc-border py-5 space-y-4">
          <p className="font-semibold text-dc-text">Community Activity Alerts</p>
          <p className="text-sm text-dc-muted">Receive notifications for events and activity alerts in this server.</p>
          {[
            ["In-app alerts", "inAppEventAlerts"],
            ["Push notifications", "pushEventAlerts"],
          ].map(([label, key]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-dc-text">{label}</span>
              <Toggle
                checked={settings[key as keyof NotificationSettings] as boolean}
                onChange={(checked) => update({ [key]: checked } as Partial<NotificationSettings>)}
                disabled={saving}
              />
            </div>
          ))}
        </div>

        <div className="py-5 space-y-4">
          {[
            ["Suppress @everyone and @here", "suppressEveryone"],
            ["Suppress All Role @mentions", "suppressRoleMentions"],
            ["Suppress Highlights", "suppressHighlights"],
            ["Mute New Events", "muteNewEvents"],
            ["Mobile Push Notifications", "mobilePushNotifications"],
          ].map(([label, key]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-dc-text">{label}</span>
              <Toggle
                checked={settings[key as keyof NotificationSettings] as boolean}
                onChange={(checked) => update({ [key]: checked } as Partial<NotificationSettings>)}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
