"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Channel } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  serverId: string;
  onImported: (channels: Channel[]) => void;
}

export function ImportDiscordTemplateModal({ open, onClose, serverId, onImported }: Props) {
  const { addToast } = useToast();
  const [template, setTemplate] = useState("");
  const [importServerName, setImportServerName] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!template.trim()) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/templates/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, importServerName }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Template import failed", "error");
        return;
      }
      onImported(data.channels ?? []);
      addToast(`Imported ${(data.channels ?? []).length} channel${(data.channels ?? []).length === 1 ? "" : "s"}.`, "success");
      setTemplate("");
      setImportServerName(false);
      onClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Discord Template" size="md">
      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted mb-1.5">
            Template Link or Code
          </label>
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full rounded border border-dc-border bg-dc-input px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
            placeholder="https://discord.new/example"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-muted">
          <input
            type="checkbox"
            checked={importServerName}
            onChange={(e) => setImportServerName(e.target.checked)}
            className="accent-dc-accent"
          />
          Update this server name from the template
        </label>
        <div className="rounded border border-dc-border bg-dc-chat p-3 text-xs text-dc-muted">
          Public Discord templates expose channel layout. DollarCord imports text and announcement channels as text channels.
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={importing || !template.trim()}
            className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
