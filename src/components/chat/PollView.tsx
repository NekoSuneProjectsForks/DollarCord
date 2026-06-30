"use client";

import { useState } from "react";
import type { Poll } from "@/types";

interface Props {
  poll: Poll;
  currentUserId: string;
}

export function PollView({ poll, currentUserId }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const total = poll.votes.length;
  const closed = Boolean(poll.closesAt && new Date(poll.closesAt) < new Date());

  async function vote(optionId: string) {
    if (closed) return;
    setBusy(optionId);
    try {
      await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      // The server broadcasts channel:message:update; the list refreshes the poll.
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 max-w-md rounded-lg border border-dc-border bg-dc-sidebar p-3">
      <p className="text-sm font-semibold text-dc-text mb-2">📊 {poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const votes = poll.votes.filter((v) => v.optionId === opt.id);
          const pct = total > 0 ? Math.round((votes.length / total) * 100) : 0;
          const mine = votes.some((v) => v.userId === currentUserId);
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={busy === opt.id || closed}
              className={`relative block w-full overflow-hidden rounded border text-left text-sm transition-colors ${
                mine ? "border-dc-accent" : "border-dc-border hover:border-dc-accent/60"
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-dc-accent/20" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between px-3 py-1.5">
                <span className="text-dc-text">{mine ? "✓ " : ""}{opt.text}</span>
                <span className="text-dc-faint text-xs">{pct}% · {votes.length}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-dc-faint text-xs mt-2">
        {total} vote{total === 1 ? "" : "s"}{poll.multiple ? " · multiple choice" : ""}{closed ? " · closed" : ""}
      </p>
    </div>
  );
}
