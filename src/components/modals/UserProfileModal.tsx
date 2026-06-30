"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatShortDate } from "@/lib/dateTime";
import { useSocket } from "@/contexts/SocketContext";
import { displayStatus, isShownOnline } from "@/lib/presenceStatus";
import type { Activity, LiveStreamStatus, ServerMember, User } from "@/types";

interface RecentActivity {
  id: string;
  type: string;
  name: string;
  largeImage: string | null;
  details: string | null;
  lastSeenAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTIVITY_VERB: Record<string, string> = {
  PLAYING: "Playing",
  STREAMING: "Streaming",
  LISTENING: "Listening to",
  WATCHING: "Watching",
  COMPETING: "Competing in",
  CUSTOM: "",
};

const STATUS_LABEL: Record<string, string> = {
  ONLINE: "Online",
  IDLE: "Idle",
  DND: "Do Not Disturb",
  STREAMING: "Streaming",
  INVISIBLE: "Offline",
  OFFLINE: "Offline",
};

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  serverId?: string;
}

interface ProfileData {
  user: Pick<
    User,
    "id" | "username" | "displayName" | "bio" | "avatarUrl" | "twitchChannel" | "kickChannel" | "isPlatformAdmin" | "createdAt"
  >;
  member: (ServerMember & { roles?: NonNullable<ServerMember["roles"]> }) | null;
  streams: LiveStreamStatus[];
}

// Deterministic banner gradient from the username.
function bannerGradient(seed: string): string {
  const palettes = [
    ["#7c6af7", "#3b2e8c"],
    ["#ec4899", "#7c3aed"],
    ["#06b6d4", "#1e3a8a"],
    ["#10b981", "#065f46"],
    ["#f59e0b", "#b45309"],
    ["#ef4444", "#7f1d1d"],
  ];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  const [a, b] = palettes[h % palettes.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-dc-muted mb-1.5">{title}</p>
      {children}
    </div>
  );
}

export function UserProfileModal({ open, onClose, userId, serverId }: Props) {
  const { activities: liveActivities, presence, statuses } = useSocket();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedActivities, setFetchedActivities] = useState<Activity[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [tab, setTab] = useState<"profile" | "activity">("profile");

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      setFetchedActivities([]);
      setRecent([]);
      setTab("profile");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/users/${userId}/profile${serverId ? `?serverId=${serverId}` : ""}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
    fetch(`/api/presence?userIds=${userId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFetchedActivities(data?.activities?.[userId] ?? []))
      .catch(() => {});
    fetch(`/api/users/${userId}/activity-history`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRecent(data?.recent ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [open, userId, serverId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const user = profile?.user;
  const roles = profile?.member?.roles ?? [];
  const streams = profile?.streams ?? [];
  const connected = userId ? presence[userId] ?? false : false;
  const activities = (userId && liveActivities[userId]) || fetchedActivities;
  const status = displayStatus({ connected, chosenStatus: userId ? statuses[userId]?.status : null, activities });
  const online = isShownOnline(status);
  const customStatus = userId ? statuses[userId]?.customStatus : null;
  // Hide live activity entirely when offline/invisible.
  const currentActivities = online ? activities : [];
  const liveStreams = online ? streams.filter((s) => s.isLive) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl bg-dc-sidebar shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>

        {loading && <div className="p-8 text-center text-dc-muted text-sm">Loading profile…</div>}

        {!loading && user && (
          <>
            {/* Banner */}
            <div className="h-24 w-full" style={{ background: bannerGradient(user.username) }} />

            {/* Avatar overlapping the banner */}
            <div className="px-4">
              <div className="-mt-10 mb-2 flex items-end justify-between">
                <div className="rounded-full ring-4 ring-dc-sidebar">
                  <Avatar user={user} size="lg" online={isShownOnline(status)} status={status} />
                </div>
              </div>

              {/* Identity card */}
              <div className="rounded-lg bg-dc-chat p-3 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-dc-text truncate">{user.displayName}</h3>
                    {user.isPlatformAdmin && (
                      <span className="rounded bg-dc-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dc-accent">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-dc-muted">@{user.username}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        status === "STREAMING" ? "bg-purple-500" : status === "DND" ? "bg-dc-danger" : status === "IDLE" ? "bg-dc-warning" : online ? "bg-dc-success" : "bg-dc-faint"
                      }`}
                    />
                    <span className="text-xs text-dc-muted">{customStatus || STATUS_LABEL[status]}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-3 border-b border-dc-border -mx-1 px-1">
                  {(["profile", "activity"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`pb-2 text-sm capitalize transition-colors ${
                        tab === t ? "text-dc-text border-b-2 border-dc-accent" : "text-dc-muted hover:text-dc-text"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="max-h-[44vh] overflow-y-auto scrollbar-thin space-y-3 pr-1">
                  {tab === "profile" && (
                    <>
                      {user.bio && (
                        <Section title="About Me">
                          <p className="text-sm text-dc-text whitespace-pre-wrap">{user.bio}</p>
                        </Section>
                      )}

                      <Section title="Member Since">
                        <p className="text-sm text-dc-muted">
                          {formatShortDate(user.createdAt)}
                          {profile.member && ` · joined this server ${formatShortDate(profile.member.joinedAt)}`}
                        </p>
                      </Section>

                      {roles.length > 0 && (
                        <Section title={`Roles — ${roles.length}`}>
                          <div className="flex flex-wrap gap-1.5">
                            {roles.map(({ role }) => (
                              <span
                                key={role.id}
                                className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                                style={{ color: role.color, borderColor: `${role.color}66`, backgroundColor: `${role.color}1A` }}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                                {role.name}
                              </span>
                            ))}
                          </div>
                        </Section>
                      )}

                      {(user.twitchChannel || user.kickChannel) && (
                        <Section title="Connections">
                          <div className="space-y-1.5">
                            {user.twitchChannel && (
                              <a href={`https://twitch.tv/${user.twitchChannel}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded border border-dc-border bg-dc-sidebar px-2.5 py-1.5 text-sm text-dc-text hover:border-dc-accent">
                                <span>🟣</span> <span className="font-medium">Twitch</span> <span className="text-dc-muted">@{user.twitchChannel}</span>
                              </a>
                            )}
                            {user.kickChannel && (
                              <a href={`https://kick.com/${user.kickChannel}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded border border-dc-border bg-dc-sidebar px-2.5 py-1.5 text-sm text-dc-text hover:border-dc-accent">
                                <span>🟢</span> <span className="font-medium">Kick</span> <span className="text-dc-muted">@{user.kickChannel}</span>
                              </a>
                            )}
                          </div>
                        </Section>
                      )}
                    </>
                  )}

                  {tab === "activity" && (
                    <>
                      <Section title="Current activity">
                        {currentActivities.length === 0 && liveStreams.length === 0 ? (
                          <p className="text-sm text-dc-muted">{online ? "Nothing right now." : "Offline."}</p>
                        ) : (
                          <div className="space-y-2">
                            {currentActivities.map((a) => {
                              const streaming = a.type === "STREAMING";
                              return (
                                <div key={a.id} className="rounded-lg bg-dc-sidebar p-2.5">
                                  <p className="text-[11px] font-semibold text-dc-muted mb-1">
                                    {streaming ? "Streaming" : a.type === "CUSTOM" ? "Custom Status" : ACTIVITY_VERB[a.type] ?? "Playing"}
                                  </p>
                                  <div className="flex items-start gap-3">
                                    {a.largeImage && <img src={a.largeImage} alt="" className="h-12 w-12 rounded object-cover shrink-0" />}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-dc-text break-words">{a.name}</p>
                                      {a.details && <p className="text-xs text-dc-muted truncate">{a.details}</p>}
                                      {a.state && <p className="text-xs text-dc-faint truncate">{a.state}</p>}
                                      {a.partyMax ? <p className="text-xs text-dc-faint">Party: {a.partyCurrent ?? 0} of {a.partyMax}</p> : null}
                                      {streaming && a.url && (
                                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block rounded bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500">Watch</a>
                                      )}
                                      {!streaming && a.joinUrl && (
                                        <a href={a.joinUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block rounded bg-dc-accent px-3 py-1 text-xs font-semibold text-white hover:bg-dc-accent-hover">Join</a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>

                      {recent.length > 0 && (
                        <Section title="Recent activity">
                          <div className="space-y-2">
                            {recent.map((r) => (
                              <div key={r.id} className="flex items-center gap-3 rounded-lg bg-dc-sidebar p-2.5">
                                {r.largeImage ? (
                                  <img src={r.largeImage} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-dc-chat flex items-center justify-center shrink-0">🎮</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-dc-text truncate">{r.name}</p>
                                  <p className="text-xs text-dc-faint">🎮 {timeAgo(r.lastSeenAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Section>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="h-4" />
            </div>
          </>
        )}

        {!loading && !user && <div className="p-8 text-center text-dc-muted text-sm">Profile unavailable.</div>}
      </div>
    </div>
  );
}
