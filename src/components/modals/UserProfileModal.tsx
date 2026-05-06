"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate } from "@/lib/dateTime";
import type { LiveStreamStatus, ServerMember, User } from "@/types";

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

function providerLabel(provider: LiveStreamStatus["provider"]) {
  return provider === "twitch" ? "Twitch" : "Kick";
}

export function UserProfileModal({ open, onClose, userId, serverId }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/users/${userId}/profile${serverId ? `?serverId=${serverId}` : ""}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, userId, serverId]);

  const user = profile?.user;
  const roles = profile?.member?.roles ?? [];
  const streams = profile?.streams ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Profile">
      {loading && <p className="text-dc-muted text-sm">Loading profile...</p>}

      {!loading && user && (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-dc-text truncate">{user.displayName}</h3>
                {user.isPlatformAdmin && (
                  <span className="rounded-full bg-dc-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-dc-muted">@{user.username}</p>
              {profile.member && (
                <p className="text-xs text-dc-faint mt-1">Joined {formatShortDate(profile.member.joinedAt)}</p>
              )}
            </div>
          </div>

          {user.bio && <p className="text-sm text-dc-muted whitespace-pre-wrap">{user.bio}</p>}

          {roles.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.map(({ role }) => (
                  <span
                    key={role.id}
                    className="rounded-full border border-dc-border px-2 py-1 text-xs font-semibold"
                    style={{ color: role.color, borderColor: `${role.color}66`, backgroundColor: `${role.color}1A` }}
                  >
                    {role.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {streams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Streaming</p>
              {streams.map((stream) => (
                <div key={stream.provider} className="rounded border border-dc-border bg-dc-chat p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${stream.isLive ? "bg-dc-danger" : "bg-dc-faint"}`} />
                        <p className="text-sm font-semibold text-dc-text">
                          {providerLabel(stream.provider)} {stream.isLive ? "Live" : "Offline"}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-sm text-dc-muted">{stream.title ?? `@${stream.channel}`}</p>
                      {stream.category && <p className="text-xs text-dc-faint">{stream.category}</p>}
                    </div>
                    <a
                      href={stream.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                        stream.isLive
                          ? "bg-dc-accent text-white hover:bg-dc-accent-hover"
                          : "bg-dc-hover text-dc-text hover:bg-dc-border"
                      }`}
                    >
                      {stream.isLive ? "Watch Stream" : "Open Channel"}
                    </a>
                  </div>
                  {stream.thumbnailUrl && (
                    <img src={stream.thumbnailUrl} alt="" className="mt-3 max-h-44 w-full rounded object-cover" />
                  )}
                  {stream.viewerCount !== null && (
                    <p className="mt-2 text-xs text-dc-muted">{stream.viewerCount.toLocaleString()} watching</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !user && <p className="text-dc-muted text-sm">Profile unavailable.</p>}
    </Modal>
  );
}
