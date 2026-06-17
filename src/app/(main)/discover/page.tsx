"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

interface DiscoverServer {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  memberCount: number;
  supporterCount: number;
  joined: boolean;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [servers, setServers] = useState<DiscoverServer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  function load(query = "") {
    setLoading(true);
    fetch(`/api/discover${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setServers(d?.servers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function join(s: DiscoverServer) {
    if (s.joined) { router.push(`/servers/${s.id}`); return; }
    setJoining(s.id);
    try {
      const res = await fetch(`/api/servers/${s.id}/join-public`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || "Failed to join", "error"); return; }
      addToast(`Joined ${s.name}!`, "success");
      router.push(`/servers/${s.id}`);
      router.refresh();
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-dc-chat">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <h1 className="text-dc-text text-2xl font-bold mb-1">Discover Servers</h1>
        <p className="text-dc-muted text-sm mb-6">Public communities you can join right away.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); load(q); }}
          className="mb-6"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search public servers…"
            className="w-full bg-dc-input text-dc-text px-4 py-2.5 rounded-lg border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
          />
        </form>

        {loading ? (
          <p className="text-dc-muted text-sm">Loading…</p>
        ) : servers.length === 0 ? (
          <p className="text-dc-muted text-sm">No public servers yet. Server owners can enable discovery in Server Settings.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servers.map((s) => (
              <div key={s.id} className="rounded-lg border border-dc-border bg-dc-sidebar p-4 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  {s.iconUrl ? (
                    <img src={s.iconUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-dc-accent/30 flex items-center justify-center font-bold text-dc-text">
                      {s.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-dc-text truncate">{s.name}</p>
                    <p className="text-xs text-dc-faint">
                      {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                      {s.supporterCount > 0 && ` · ★ ${s.supporterCount}`}
                    </p>
                  </div>
                </div>
                {s.description && <p className="text-sm text-dc-muted mb-3 line-clamp-3 flex-1">{s.description}</p>}
                <button
                  onClick={() => join(s)}
                  disabled={joining === s.id}
                  className="mt-auto rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50"
                >
                  {s.joined ? "Open" : joining === s.id ? "Joining…" : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
