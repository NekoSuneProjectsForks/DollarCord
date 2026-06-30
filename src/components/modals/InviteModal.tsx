"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { formatShortDate } from "@/lib/dateTime";
import type { Invite } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  serverId: string;
}

export function InviteModal({ open, onClose, serverId }: Props) {
  const { addToast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/servers/${serverId}/invites`)
      .then((r) => r.json())
      .then((d) => setInvites(d.invites ?? []))
      .finally(() => setLoading(false));
  }, [open, serverId]);

  async function createInvite() {
    setCreating(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || "Failed to create invite", "error"); return; }
      setInvites((prev) => [data.invite, ...prev]);
      addToast("Invite created!", "success");
    } finally {
      setCreating(false);
    }
  }

  async function deleteInvite(code: string) {
    await fetch(`/api/servers/${serverId}/invites?code=${code}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.code !== code));
    addToast("Invite deleted", "info");
  }

  function inviteUrl(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/invite/${code}`;
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(inviteUrl(code)).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      addToast("Invite link copied! Paste it anywhere to share.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite People" size="lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-dc-muted text-sm">Share an invite link — paste it in any chat or DM and it becomes a Join button.</p>
          <button
            onClick={createInvite}
            disabled={creating}
            className="px-3 py-1.5 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors shrink-0"
          >
            {creating ? "Creating…" : "+ New Invite"}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-dc-muted text-sm">Loading invites…</div>
        ) : invites.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-dc-muted text-sm">No active invites. Create one above!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 bg-dc-chat rounded-lg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <code className="block font-mono text-dc-accent text-sm font-semibold truncate">/invite/{invite.code}</code>
                  <p className="text-dc-faint text-[11px] truncate">{inviteUrl(invite.code)}</p>
                </div>
                <div className="text-dc-muted text-xs text-right shrink-0">
                  <p>Used {invite.uses}{invite.maxUses ? `/${invite.maxUses}` : ""} time{invite.uses !== 1 ? "s" : ""}</p>
                  {invite.expiresAt && (
                    <p>Expires {formatShortDate(invite.expiresAt)}</p>
                  )}
                </div>
                <button
                  onClick={() => copyLink(invite.code)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors shrink-0 ${
                    copiedCode === invite.code
                      ? "bg-dc-success text-white"
                      : "bg-dc-accent hover:bg-dc-accent-hover text-white"
                  }`}
                >
                  {copiedCode === invite.code ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => deleteInvite(invite.code)}
                  className="text-dc-muted hover:text-dc-danger transition-colors text-sm"
                  title="Delete invite"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
