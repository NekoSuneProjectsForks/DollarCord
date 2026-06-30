"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Preview {
  valid: boolean;
  expired?: boolean;
  joined?: boolean;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
}

export default function InvitePage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invites/${params.code}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then((d) => setPreview(d))
      .catch(() => setPreview({ valid: false } as Preview))
      .finally(() => setLoading(false));
  }, [params.code]);

  async function join() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/servers/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: params.code }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/invite/${params.code}`)}`);
        return;
      }
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Failed to join"); return; }
      router.push(`/servers/${d.server?.id ?? preview?.server.id ?? ""}`);
      router.refresh();
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-dc-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg bg-dc-sidebar p-8 text-center shadow-2xl">
        {loading ? (
          <p className="text-dc-muted text-sm">Loading invite…</p>
        ) : preview?.server ? (
          <>
            {preview.server.iconUrl ? (
              <img src={preview.server.iconUrl} alt="" className="mx-auto h-20 w-20 rounded-3xl object-cover" />
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-dc-accent/30 text-2xl font-bold text-dc-text">
                {preview.server.name[0]?.toUpperCase()}
              </div>
            )}
            <p className="mt-4 text-xs uppercase tracking-wide text-dc-muted">You've been invited to join</p>
            <h1 className="text-xl font-bold text-dc-text">{preview.server.name}</h1>
            <p className="mt-1 text-sm text-dc-faint">{preview.server.memberCount} members</p>
            {error && <p className="mt-3 text-sm text-dc-danger">{error}</p>}
            <button
              onClick={join}
              disabled={joining || (!preview.valid && !preview.joined)}
              className={`mt-5 w-full rounded-md py-2.5 text-sm font-semibold ${
                preview.joined ? "bg-dc-hover text-dc-text" : preview.valid ? "bg-dc-success text-white hover:opacity-90" : "bg-dc-hover text-dc-faint"
              }`}
            >
              {preview.joined ? "Open Server" : preview.valid ? (joining ? "Joining…" : "Accept Invite") : preview.expired ? "Invite Expired" : "Invalid Invite"}
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">🚫</div>
            <h1 className="text-lg font-bold text-dc-text">Invite invalid or expired</h1>
            <p className="mt-1 text-sm text-dc-muted">This invite link is no longer valid.</p>
          </>
        )}
      </div>
    </div>
  );
}
