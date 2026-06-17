"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { Activity, ActivityType, User, UserStatus } from "@/types";

interface Props { user: User }

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "ONLINE", label: "Online", color: "bg-dc-success" },
  { value: "IDLE", label: "Idle", color: "bg-dc-warning" },
  { value: "DND", label: "Do Not Disturb", color: "bg-dc-danger" },
  { value: "INVISIBLE", label: "Invisible", color: "bg-dc-faint" },
];

const ACTIVITY_TYPES: ActivityType[] = ["PLAYING", "STREAMING", "LISTENING", "WATCHING", "COMPETING"];

export function ActivitySettings({ user }: Props) {
  const { setUser } = useAuth();
  const { addToast } = useToast();

  const [status, setStatus] = useState<UserStatus>((user.status as UserStatus) ?? "ONLINE");
  const [customStatus, setCustomStatus] = useState(user.customStatus ?? "");

  const [activityType, setActivityType] = useState<ActivityType>("PLAYING");
  const [activityName, setActivityName] = useState("");
  const [activityDetails, setActivityDetails] = useState("");
  const [activityJoinUrl, setActivityJoinUrl] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);

  const [rpcToken, setRpcToken] = useState<string | null>(null);
  const [twitchInfo, setTwitchInfo] = useState<string | null>(null);

  const inputCls =
    "w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm";
  const labelCls = "block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5";

  useEffect(() => {
    fetch("/api/users/me/activity").then((r) => r.json()).then((d) => setActivities(d.activities ?? [])).catch(() => {});
    fetch("/api/users/me/rpc-token").then((r) => r.json()).then((d) => setRpcToken(d.token ?? null)).catch(() => {});
  }, []);

  async function saveStatus() {
    const res = await fetch("/api/users/me/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, customStatus: customStatus || null }),
    });
    const data = await res.json();
    if (!res.ok) return addToast(data.error || "Failed to update status", "error");
    setUser(data.user);
    addToast("Status updated!", "success");
  }

  async function setManualActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityName.trim()) return;
    const res = await fetch("/api/users/me/activity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activityType,
        name: activityName,
        details: activityDetails || null,
        joinUrl: activityJoinUrl.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) return addToast(data.error || "Failed to set activity", "error");
    setActivities(data.activities ?? []);
    addToast("Activity set!", "success");
  }

  async function clearManualActivity() {
    await fetch("/api/users/me/activity", { method: "DELETE" });
    const res = await fetch("/api/users/me/activity");
    const data = await res.json();
    setActivities(data.activities ?? []);
    addToast("Manual activity cleared.", "success");
  }

  async function regenerateToken() {
    const res = await fetch("/api/users/me/rpc-token", { method: "POST" });
    const data = await res.json();
    setRpcToken(data.token);
    addToast("New RPC token generated.", "success");
  }

  async function refreshTwitch() {
    setTwitchInfo("Checking…");
    const res = await fetch("/api/users/me/twitch");
    const data = await res.json();
    if (!data.twitch && !data.kick) {
      setTwitchInfo("Link a Twitch or Kick channel in your Profile first (Twitch also needs server credentials).");
      return;
    }
    const parts: string[] = [];
    if (data.twitch) parts.push(`Twitch: ${data.twitch.isLive ? `live — ${data.twitch.title ?? "streaming"}` : "offline"}`);
    if (data.kick) parts.push(`Kick: ${data.kick.isLive ? `live — ${data.kick.title ?? "streaming"}` : "offline"}`);
    setTwitchInfo(parts.join(" · "));
    const r = await fetch("/api/users/me/activity");
    setActivities((await r.json()).activities ?? []);
  }

  return (
    <>
      <h2 className="text-dc-text text-xl font-bold mb-6">Activity & Presence</h2>

      {/* Status */}
      <div className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Status</h3>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                status === opt.value ? "border-dc-accent bg-dc-accent/10 text-dc-text" : "border-dc-border text-dc-muted hover:text-dc-text"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${opt.color}`} />
              {opt.label}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>Custom Status</label>
          <input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} maxLength={128} className={inputCls} placeholder="What's happening?" />
        </div>
        <button onClick={saveStatus} className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover text-white text-sm font-semibold rounded transition-colors">
          Save Status
        </button>
      </div>

      {/* Manual activity */}
      <form onSubmit={setManualActivity} className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Set Rich Presence</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)} className={inputCls}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <input value={activityName} onChange={(e) => setActivityName(e.target.value)} maxLength={128} className={inputCls} placeholder="e.g. Minecraft" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Details (optional)</label>
          <input value={activityDetails} onChange={(e) => setActivityDetails(e.target.value)} maxLength={128} className={inputCls} placeholder="e.g. Survival world" />
        </div>
        <div>
          <label className={labelCls}>Join URL (optional)</label>
          <input value={activityJoinUrl} onChange={(e) => setActivityJoinUrl(e.target.value)} maxLength={512} className={inputCls} placeholder="https://… — others see a Join button" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover text-white text-sm font-semibold rounded transition-colors">
            Set Activity
          </button>
          <button type="button" onClick={clearManualActivity} className="px-5 py-2 bg-dc-hover hover:bg-dc-border text-dc-text text-sm font-semibold rounded transition-colors">
            Clear
          </button>
        </div>
        {activities.length > 0 && (
          <div className="pt-2 border-t border-dc-border space-y-1">
            <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold">Active now</p>
            {activities.map((a) => (
              <p key={a.id} className="text-sm text-dc-text">
                <span className="text-dc-muted">{a.type.charAt(0) + a.type.slice(1).toLowerCase()}</span> {a.name}
                <span className="text-dc-faint text-xs"> · via {a.source}</span>
              </p>
            ))}
          </div>
        )}
      </form>

      {/* Streams */}
      <div className="bg-dc-sidebar rounded-lg p-4 mb-6 space-y-3">
        <h3 className="text-dc-text font-semibold">Stream Live Detection</h3>
        <p className="text-dc-muted text-sm">
          Link your Twitch and/or Kick channel in the Profile tab. When you go live a “Streaming” presence appears
          automatically (a background poller also checks every couple of minutes), and servers with a live-announce
          channel will post that you&apos;re live.
        </p>
        <button onClick={refreshTwitch} className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover text-white text-sm font-semibold rounded transition-colors">
          Check Stream Status
        </button>
        {twitchInfo && <p className="text-dc-muted text-sm">{twitchInfo}</p>}
      </div>

      {/* RPC token */}
      <div className="bg-dc-sidebar rounded-lg p-4 space-y-3">
        <h3 className="text-dc-text font-semibold">Game / App Rich Presence (RPC)</h3>
        <p className="text-dc-muted text-sm">
          Generate a token so a local game or app (or the future desktop agent) can push Rich Presence to your profile.
          POST a Discord <code className="text-dc-accent">SetActivity</code>-shaped payload to
          <code className="text-dc-accent"> /api/rpc/activity</code> with
          <code className="text-dc-accent"> Authorization: Bearer &lt;token&gt;</code>.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={rpcToken ?? "No token generated yet"}
            className={`${inputCls} font-mono`}
            onFocus={(e) => e.currentTarget.select()}
          />
          {rpcToken && (
            <button
              onClick={() => { navigator.clipboard?.writeText(rpcToken); addToast("Token copied.", "success"); }}
              className="shrink-0 px-3 py-2 bg-dc-hover hover:bg-dc-border text-dc-text text-sm font-semibold rounded transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        <button onClick={regenerateToken} className="px-5 py-2 bg-dc-accent hover:bg-dc-accent-hover text-white text-sm font-semibold rounded transition-colors">
          {rpcToken ? "Regenerate Token" : "Generate Token"}
        </button>
        <pre className="bg-dc-input rounded p-3 text-xs text-dc-muted overflow-x-auto">{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/rpc/activity \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"activity":{"type":0,"name":"My Game","details":"In a match","state":"Round 2"}}'`}</pre>
      </div>
    </>
  );
}
