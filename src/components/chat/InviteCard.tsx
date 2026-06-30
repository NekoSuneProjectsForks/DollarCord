"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

interface Preview {
  valid: boolean;
  expired?: boolean;
  joined?: boolean;
  code: string;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
}

// Discord-style invite embed: when an invite URL is posted, show the server +
// a Join button that actually joins the server.
export function InviteCard({ code }: { code: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/invites/${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d && setPreview(d))
      .catch(() => {});
    return () => { active = false; };
  }, [code]);

  if (!preview || !preview.server) return null;

  async function join() {
    if (!preview) return;
    if (preview.joined) { router.push(`/servers/${preview.server.id}`); return; }
    setJoining(true);
    try {
      const res = await fetch("/api/servers/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || "Failed to join", "error"); return; }
      addToast(`Joined ${preview.server.name}!`, "success");
      router.push(`/servers/${preview.server.id}`);
      router.refresh();
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="mt-2 max-w-sm rounded-lg bg-dc-sidebar p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-dc-muted mb-2">You've been invited to join a server</p>
      <div className="flex items-center gap-3">
        {preview.server.iconUrl ? (
          <img src={preview.server.iconUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dc-accent/30 font-bold text-dc-text">
            {preview.server.name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-dc-text truncate">{preview.server.name}</p>
          <p className="text-xs text-dc-faint">{preview.server.memberCount} member{preview.server.memberCount === 1 ? "" : "s"}</p>
        </div>
        <button
          onClick={join}
          disabled={joining || (!preview.valid && !preview.joined)}
          className={`shrink-0 rounded px-4 py-2 text-sm font-semibold transition-colors ${
            preview.joined
              ? "bg-dc-hover text-dc-text hover:bg-dc-border"
              : preview.valid
              ? "bg-dc-success text-white hover:opacity-90"
              : "bg-dc-hover text-dc-faint cursor-not-allowed"
          }`}
        >
          {preview.joined ? "Joined" : preview.valid ? (joining ? "Joining…" : "Join") : preview.expired ? "Expired" : "Invalid"}
        </button>
      </div>
    </div>
  );
}
