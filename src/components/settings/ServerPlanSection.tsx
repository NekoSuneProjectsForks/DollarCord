"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import type { PlanLimits } from "@/lib/plans";

interface PlanResponse {
  planId: string;
  plan: PlanLimits;
  selfHosted: boolean;
  freeForever: boolean;
  freeCutoff: string;
  support: { monthlyUsd: number; yearlyUsd: number };
  catalog: Record<string, PlanLimits>;
  usage: { members: number; voiceChannels: number; textChannels: number; storageBytes: number };
}

interface Props {
  serverId: string;
  isOwner: boolean;
}

function fmt(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString();
}
function fmtBytes(n: number | null): string {
  if (n === null) return "Unlimited";
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(0)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${n} B`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-dc-chat px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dc-faint">{label}</p>
      <p className="text-sm font-semibold text-dc-text">{value}</p>
    </div>
  );
}

export function ServerPlanSection({ serverId, isOwner }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(`/api/servers/${serverId}/plan`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }
  useEffect(load, [serverId]);

  async function setPlan(plan: "FREE" | "GOLD") {
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || "Failed", "error"); return; }
      addToast(plan === "GOLD" ? "Upgraded to Gold!" : "Switched to Free.", "success");
      load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const { plan, usage, selfHosted } = data;
  const f = plan.features;

  return (
    <div className="border-t border-dc-border pt-5 mb-6">
      <h3 className="text-dc-text font-semibold mb-2">Server Tier</h3>

      <div className="rounded-lg border border-dc-border bg-dc-sidebar p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{selfHosted ? "🛡️" : plan.id === "GOLD" ? "⭐" : "📦"}</span>
          <span className="font-bold text-dc-text">{plan.name}{plan.id === "GOLD" ? " — $5/mo" : ""}</span>
          {selfHosted && <span className="rounded-full bg-dc-success/20 px-2 py-0.5 text-[10px] font-semibold text-dc-success">Active</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <Stat label="Members" value={selfHosted ? "Unlimited" : `${usage.members} / ${fmt(plan.maxMembers)}`} />
          <Stat label="Text Channels" value={selfHosted ? "Unlimited" : `${usage.textChannels} / ${fmt(plan.maxTextChannels)}`} />
          <Stat label="Voice Channels" value={selfHosted ? "Unlimited" : `${usage.voiceChannels} / ${fmt(plan.maxVoiceChannels)}`} />
          <Stat label="Storage" value={selfHosted ? "Unlimited" : `${fmtBytes(usage.storageBytes)} / ${fmtBytes(plan.storageBytes)}`} />
          <Stat label="Upload Limit" value={fmtBytes(plan.maxFileBytes)} />
          <Stat label="Screen Share" value={f.screenShareMax} />
          <Stat label="Voice" value={`${plan.voiceBitrateKbps} kbps`} />
          <Stat label="Custom Emojis" value={fmt(plan.customEmojis)} />
          <Stat label="Soundboard" value={`${plan.soundboardSlots} slots`} />
          <Stat label="Applications" value={f.serverApplications ? "Enabled" : "—"} />
          <Stat label="Spatial Audio" value={f.spatialAudio ? "GameLink" : "—"} />
          <Stat label="DJ" value={f.videoDj ? "Video + Music" : `Music (${f.musicDjKbps}k)`} />
        </div>

        {selfHosted ? (
          <div className="space-y-2">
            <p className="text-sm text-dc-muted">This community runs on your own infrastructure.</p>
            {data.freeForever && (
              <div className="rounded border border-dc-success/30 bg-dc-success/10 px-3 py-2 text-sm text-dc-success">
                Early adopter — free forever! Activate before {new Date(data.freeCutoff).toLocaleDateString()}.
              </div>
            )}
            <p className="text-xs text-dc-faint">Want to support development? An optional subscription helps keep it going.</p>
            <div className="flex gap-2">
              <button className="rounded bg-dc-hover px-3 py-2 text-sm text-dc-text hover:bg-dc-border" onClick={() => addToast("Optional support checkout is coming soon.", "info")}>
                Support — ${data.support.monthlyUsd.toFixed(2)}/mo
              </button>
              <button className="rounded bg-dc-hover px-3 py-2 text-sm text-dc-text hover:bg-dc-border" onClick={() => addToast("Optional support checkout is coming soon.", "info")}>
                Support — ${data.support.yearlyUsd.toFixed(2)}/yr
              </button>
            </div>
          </div>
        ) : (
          isOwner && (
            <div className="flex flex-wrap gap-2">
              {plan.id === "FREE" ? (
                <button onClick={() => setPlan("GOLD")} disabled={busy} className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50">
                  Upgrade to Gold — $5/mo
                </button>
              ) : (
                <button onClick={() => setPlan("FREE")} disabled={busy} className="rounded bg-dc-hover px-4 py-2 text-sm font-semibold text-dc-text hover:bg-dc-border disabled:opacity-50">
                  Downgrade to Free
                </button>
              )}
              <p className="w-full text-xs text-dc-faint">Self-serve $5 checkout is wired to billing in a later pass; this toggle activates the tier for now.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
