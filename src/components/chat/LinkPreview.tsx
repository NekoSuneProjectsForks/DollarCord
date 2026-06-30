"use client";

import { useEffect, useState } from "react";

interface Preview {
  url: string;
  siteName: string;
  title: string;
  description: string | null;
  image: string | null;
}

// Lightweight OpenGraph link preview — fetched from /api/unfurl on mount.
export function LinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d?.preview && setPreview(d.preview))
      .catch(() => {});
    return () => { active = false; };
  }, [url]);

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-xl gap-3 overflow-hidden rounded border border-dc-border bg-dc-sidebar p-3 hover:border-dc-accent transition-colors"
      style={{ borderLeftColor: "#7c6af7", borderLeftWidth: 4 }}
    >
      {preview.image && (
        <img src={preview.image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
      )}
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wide text-dc-faint truncate">{preview.siteName}</span>
        <span className="block text-sm font-semibold text-dc-text truncate">{preview.title}</span>
        {preview.description && (
          <span className="mt-0.5 block text-xs text-dc-muted line-clamp-2">{preview.description}</span>
        )}
      </span>
    </a>
  );
}
