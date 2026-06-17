"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import { PERMISSION_LIST, Permission, has } from "@/lib/permissionFlags";

interface Props {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

interface Target {
  type: "EVERYONE" | "ROLE";
  id: string;
  name: string;
  color?: string;
  allow: number;
  deny: number;
}

type TriState = "allow" | "inherit" | "deny";

export function ChannelPermissionsModal({ open, onClose, channelId, channelName }: Props) {
  const { addToast } = useToast();
  const router = useRouter();
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<string>("everyone");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/channels/${channelId}/permissions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const overrides: any[] = d.overrides ?? [];
        const find = (type: string, id: string) => overrides.find((o) => o.targetType === type && o.targetId === id);
        const everyone = find("EVERYONE", "everyone");
        const list: Target[] = [
          { type: "EVERYONE", id: "everyone", name: "@everyone", allow: everyone?.allow ?? 0, deny: everyone?.deny ?? 0 },
          ...(d.roles ?? []).map((r: any) => {
            const o = find("ROLE", r.id);
            return { type: "ROLE" as const, id: r.id, name: r.name, color: r.color, allow: o?.allow ?? 0, deny: o?.deny ?? 0 };
          }),
        ];
        setTargets(list);
        setSelected("everyone");
      })
      .catch(() => {});
  }, [open, channelId]);

  function stateOf(t: Target, bit: number): TriState {
    if (has(t.allow, bit)) return "allow";
    if (has(t.deny, bit)) return "deny";
    return "inherit";
  }

  function setState(targetId: string, bit: number, next: TriState) {
    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== targetId) return t;
        let allow = t.allow & ~bit;
        let deny = t.deny & ~bit;
        if (next === "allow") allow |= bit;
        if (next === "deny") deny |= bit;
        return { ...t, allow, deny };
      })
    );
  }

  function makePrivate() {
    setState("everyone", Permission.VIEW_CHANNEL, "deny");
    setSelected("everyone");
    addToast("Channel set to private — grant View to specific roles, then Save.", "info");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: targets.map((t) => ({ targetType: t.type, targetId: t.id, allow: t.allow, deny: t.deny })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to save permissions", "error");
        return;
      }
      addToast("Channel permissions saved.", "success");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const active = targets.find((t) => t.id === selected);

  return (
    <Modal open={open} onClose={onClose} title={`Permissions — #${channelName}`} size="lg">
      <div className="flex gap-4 min-h-[20rem]">
        {/* Targets */}
        <div className="w-44 shrink-0 space-y-1 border-r border-dc-border pr-3">
          <button onClick={makePrivate} className="w-full rounded bg-dc-hover px-2 py-1.5 text-xs font-semibold text-dc-text hover:bg-dc-border mb-2">
            🔒 Make Private
          </button>
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm ${selected === t.id ? "bg-dc-active text-dc-text" : "text-dc-muted hover:bg-dc-hover"}`}
              style={t.color ? { color: selected === t.id ? undefined : t.color } : undefined}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Permission tri-states */}
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
          {active &&
            PERMISSION_LIST.map((p) => {
              const cur = stateOf(active, p.bit);
              return (
                <div key={p.key} className="flex items-center justify-between py-1.5 border-b border-dc-border/50">
                  <span className="text-sm text-dc-text">{p.label}</span>
                  <div className="flex rounded bg-dc-input p-0.5 text-xs">
                    {(["deny", "inherit", "allow"] as TriState[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setState(active.id, p.bit, s)}
                        className={`px-2 py-1 rounded capitalize ${
                          cur === s
                            ? s === "allow"
                              ? "bg-dc-success text-white"
                              : s === "deny"
                              ? "bg-dc-danger text-white"
                              : "bg-dc-border text-dc-text"
                            : "text-dc-muted hover:text-dc-text"
                        }`}
                      >
                        {s === "inherit" ? "/" : s === "allow" ? "✓" : "✕"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50">
          {saving ? "Saving…" : "Save Permissions"}
        </button>
      </div>
    </Modal>
  );
}
