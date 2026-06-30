"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserBar } from "./UserBar";
import { Avatar } from "@/components/ui/Avatar";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";
import { CreateEventModal } from "@/components/modals/CreateEventModal";
import { EventDetailsModal } from "@/components/modals/EventDetailsModal";
import { ImportDiscordTemplateModal } from "@/components/modals/ImportDiscordTemplateModal";
import { InviteModal } from "@/components/modals/InviteModal";
import { ServerNotificationSettingsModal } from "@/components/modals/ServerNotificationSettingsModal";
import { ServerPrivacySettingsModal } from "@/components/modals/ServerPrivacySettingsModal";
import { ServerSettingsModal } from "@/components/settings/ServerSettingsModal";
import { ChannelPermissionsModal } from "@/components/modals/ChannelPermissionsModal";
import { formatShortDate, formatTime } from "@/lib/dateTime";
import type { Channel, ChannelCategory, Server, MemberRole, ServerEvent, ServerUserSettings, UnreadMap } from "@/types";

interface Props {
  server: Server;
  channels: Channel[];
  initialEvents?: ServerEvent[];
  currentUserId: string;
  currentUserRole: MemberRole;
}

export function ChannelSidebar({ server, channels: initialChannels, initialEvents = [], currentUserId, currentUserRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { socket, voiceRooms } = useSocket();
  const { addToast } = useToast();
  const { user, logout } = useAuth();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showImportTemplate, setShowImportTemplate] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [permsChannel, setPermsChannel] = useState<Channel | null>(null);
  const [events, setEvents] = useState<ServerEvent[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<ServerEvent | null>(null);
  const [eventAlertsEnabled, setEventAlertsEnabled] = useState(true);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [unread, setUnread] = useState<UnreadMap>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [supporters, setSupporters] = useState<{ count: number; tier: number; supporting: boolean }>({
    count: 0,
    tier: 0,
    supporting: false,
  });

  useEffect(() => {
    fetch(`/api/servers/${server.id}/supporters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSupporters(d))
      .catch(() => {});
  }, [server.id]);

  async function toggleSupport() {
    const res = await fetch(`/api/servers/${server.id}/supporters`, {
      method: supporters.supporting ? "DELETE" : "POST",
    });
    if (res.ok) {
      const d = await res.json();
      setSupporters(d);
      addToast(d.supporting ? "Thanks for supporting this server!" : "You stopped supporting this server.", "success");
    }
    setShowMenu(false);
  }

  // Persist collapsed categories per server.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dc_collapsed_${server.id}`);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch {}
  }, [server.id]);

  function toggleCategory(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(`dc_collapsed_${server.id}`, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  const canManage = ["OWNER", "ADMIN"].includes(currentUserRole);
  const activeChannelId = pathname.match(/\/servers\/[^/]+\/([^/]+)/)?.[1];

  // Load categories + unread state for this server.
  useEffect(() => {
    fetch(`/api/servers/${server.id}/categories`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCategories(d.categories ?? []))
      .catch(() => {});
    fetch(`/api/servers/${server.id}/unread`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUnread(d.unread ?? {}))
      .catch(() => {});
  }, [server.id]);

  // Clear the active channel's badge locally when viewing it.
  useEffect(() => {
    if (!activeChannelId) return;
    setUnread((prev) => (prev[activeChannelId] ? { ...prev, [activeChannelId]: { unread: false, mentions: 0 } } : prev));
  }, [activeChannelId]);

  // Live unread/mention updates from the server room.
  useEffect(() => {
    if (!socket) return;
    const onActivity = ({
      channelId,
      mentionedUserIds,
      mentionsEveryone,
      authorId,
    }: {
      channelId: string;
      mentionedUserIds: string[];
      mentionsEveryone: boolean;
      authorId: string;
    }) => {
      if (channelId === activeChannelId || authorId === currentUserId) return;
      const mentionsMe = mentionsEveryone || mentionedUserIds.includes(currentUserId);
      setUnread((prev) => {
        const cur = prev[channelId] ?? { unread: false, mentions: 0 };
        return { ...prev, [channelId]: { unread: true, mentions: cur.mentions + (mentionsMe ? 1 : 0) } };
      });
    };
    socket.on("channel:activity", onActivity);
    return () => { socket.off("channel:activity", onActivity); };
  }, [socket, activeChannelId, currentUserId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("server:join", server.id);

    socket.on("server:channel:create", ({ channel }: { channel: Channel }) => {
      setChannels((prev) =>
        prev.some((c) => c.id === channel.id) ? prev : [...prev, channel].sort((a, b) => a.position - b.position)
      );
    });

    socket.on("server:channel:update", ({ channel }: { channel: Channel }) => {
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? channel : c)));
    });

    socket.on("server:channel:delete", ({ channelId }: { channelId: string }) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (activeChannelId === channelId) {
        router.push(`/servers/${server.id}`);
      }
    });

    // Permission/visibility changed — re-fetch the (filtered) channel list.
    socket.on("server:channels:refresh", () => router.refresh());

    socket.on("server:event:create", async ({ event }: { event: ServerEvent }) => {
      setEvents((prev) => {
        if (prev.some((existing) => existing.id === event.id)) return prev;
        return [...prev, event].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      });
      if (event.createdBy !== currentUserId && eventAlertsEnabled) {
        addToast(`New event: ${event.title}`, "info");
      }
    });

    socket.on("server:event:update", ({ eventId, participantCount }: { eventId: string; participantCount: number }) => {
      setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, participantCount } : event)));
      setSelectedEvent((event) => (event?.id === eventId ? { ...event, participantCount } : event));
    });

    socket.on("server:event:delete", ({ eventId }: { eventId: string }) => {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      setSelectedEvent((event) => (event?.id === eventId ? null : event));
    });

    return () => {
      socket.off("server:channel:create");
      socket.off("server:channel:update");
      socket.off("server:channel:delete");
      socket.off("server:channels:refresh");
      socket.off("server:event:create");
      socket.off("server:event:update");
      socket.off("server:event:delete");
      socket.emit("server:leave", server.id);
    };
  }, [socket, server.id, activeChannelId, router, currentUserId, eventAlertsEnabled, addToast]);

  useEffect(() => {
    fetch(`/api/servers/${server.id}/user-settings`)
      .then((res) => res.json())
      .then((data: { settings?: ServerUserSettings }) => {
        setEventAlertsEnabled(Boolean(data.settings?.inAppEventAlerts ?? true) && !data.settings?.muteNewEvents);
      })
      .catch(() => {});
  }, [server.id, showNotifications]);

  async function handleDeleteChannel(channelId: string) {
    if (!confirm("Delete this channel and all its messages?")) return;
    const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      addToast(d.error || "Failed to delete channel", "error");
    }
  }

  async function handleRenameChannel(channelId: string) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.toLowerCase().replace(/\s+/g, "-") }),
    });
    if (res.ok) {
      setEditingChannel(null);
      setEditName("");
    } else {
      const d = await res.json();
      addToast(d.error || "Rename failed", "error");
    }
  }

  async function handleLeaveServer() {
    if (!confirm("Leave this server?")) return;
    const res = await fetch(`/api/servers/${server.id}/members`, { method: "DELETE" });
    if (res.ok) {
      router.push("/channels");
      router.refresh();
    }
  }

  function handleCopyServerId() {
    navigator.clipboard?.writeText(server.id);
    addToast("Server ID copied.", "success");
    setShowMenu(false);
  }

  function updateEventState(nextEvent: ServerEvent | null) {
    if (!nextEvent) {
      if (selectedEvent) setEvents((prev) => prev.filter((event) => event.id !== selectedEvent.id));
      return;
    }
    setEvents((prev) => prev.map((event) => (event.id === nextEvent.id ? nextEvent : event)));
    setSelectedEvent(nextEvent);
  }

  const textChannels = channels.filter((c) => (c.type ?? "TEXT") !== "VOICE" && !c.categoryId);
  const voiceChannels = channels.filter((c) => c.type === "VOICE" && !c.categoryId);
  const orderedCategories = [...categories].sort((a, b) => a.position - b.position);

  function channelIcon(channel: Channel) {
    if (channel.type === "VOICE") return "🔊";
    if (channel.type === "ANNOUNCEMENT") return "📢";
    if (channel.type === "FORUM") return "🗂";
    return "#";
  }

  function renderChannelRow(channel: Channel) {
    const isActive = activeChannelId === channel.id;
    const isEditing = editingChannel === channel.id;
    const isVoice = channel.type === "VOICE";
    const vp = isVoice ? voiceRooms[channel.id] ?? [] : [];
    const u = unread[channel.id];
    const isUnread = Boolean(u?.unread) && !isActive;
    const mentions = u?.mentions ?? 0;

    return (
      <div key={channel.id}>
        <div
          className={`group relative flex items-center mx-2 rounded px-2 h-8 cursor-pointer transition-colors ${
            isActive ? "bg-dc-active text-dc-text" : "text-dc-muted hover:text-dc-text hover:bg-dc-hover"
          }`}
        >
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => { setEditingChannel(null); setEditName(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameChannel(channel.id);
                if (e.key === "Escape") { setEditingChannel(null); setEditName(""); }
              }}
              className="flex-1 bg-dc-input text-dc-text text-sm px-2 py-0.5 rounded border border-dc-accent focus:outline-none"
            />
          ) : (
            <Link href={`/servers/${server.id}/${channel.id}`} className="flex items-center gap-1.5 flex-1 min-w-0">
              {isUnread && <span className="absolute left-0 h-2 w-1 rounded-r bg-dc-text" />}
              <span className="text-dc-muted text-base leading-none">{channelIcon(channel)}</span>
              <span className={`text-sm truncate ${isUnread ? "text-dc-text font-semibold" : ""}`}>{channel.name}</span>
              {isVoice && vp.length > 0 && (
                <span className="ml-auto text-[10px] text-dc-faint">{vp.length}</span>
              )}
              {mentions > 0 && (
                <span className="ml-auto rounded-full bg-dc-danger px-1.5 text-[10px] font-bold leading-4 text-white">
                  {mentions}
                </span>
              )}
            </Link>
          )}

          {canManage && !isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => setPermsChannel(channel)}
                className="w-5 h-5 flex items-center justify-center text-dc-muted hover:text-dc-text rounded text-xs"
                title="Permissions"
              >
                🔒
              </button>
              <button
                onClick={() => { setEditingChannel(channel.id); setEditName(channel.name); }}
                className="w-5 h-5 flex items-center justify-center text-dc-muted hover:text-dc-text rounded text-xs"
                title="Rename"
              >
                ✏
              </button>
              <button
                onClick={() => handleDeleteChannel(channel.id)}
                className="w-5 h-5 flex items-center justify-center text-dc-muted hover:text-dc-danger rounded text-xs"
                title="Delete"
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {isVoice && vp.length > 0 && (
          <div className="ml-7 mr-2 mt-0.5 mb-1 space-y-0.5">
            {vp.map((p) => (
              <div key={p.socketId} className="flex items-center gap-2 px-1 py-0.5 text-dc-muted">
                <Avatar user={p} size="xs" />
                <span className="text-xs truncate flex-1">{p.displayName}</span>
                {p.muted && <span className="text-[10px] text-dc-danger" title="Muted">🔇</span>}
                {p.deafened && <span className="text-[10px] text-dc-danger" title="Deafened">🔈</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <aside className="w-60 min-h-0 bg-dc-sidebar flex flex-col shrink-0 overflow-visible">
        {/* Server header */}
        <div className="relative">
          <button
            className="w-full flex items-center justify-between px-4 h-12 font-semibold text-dc-text hover:bg-dc-hover transition-colors border-b border-dc-border"
            onClick={() => setShowMenu((p) => !p)}
          >
            <span className="flex items-center gap-1.5 truncate">
              {server.name}
              {supporters.tier > 0 && (
                <span className="shrink-0 rounded-full bg-dc-accent/20 px-1.5 text-[10px] font-bold text-dc-accent" title={`Supporter Tier ${supporters.tier} · ${supporters.count} supporters`}>
                  ★{supporters.tier}
                </span>
              )}
            </span>
            <span className="text-dc-muted ml-1">{showMenu ? "▲" : "▼"}</span>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full left-2 right-2 z-50 bg-dc-rail rounded-lg shadow-xl border border-dc-border overflow-hidden">
                <button
                  className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                  onClick={() => { setShowInvite(true); setShowMenu(false); }}
                >
                  Invite People
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors flex items-center justify-between"
                  onClick={toggleSupport}
                >
                  <span>{supporters.supporting ? "★ Supporting" : "Support this Server"}</span>
                  <span className="text-xs text-dc-faint">{supporters.count}</span>
                </button>
                {canManage && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowImportTemplate(true); setShowMenu(false); }}
                  >
                    Import Discord Template
                  </button>
                )}
                {canManage && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowSettings(true); setShowMenu(false); }}
                  >
                    Server Settings
                  </button>
                )}
                {canManage && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowCreate(true); setShowMenu(false); }}
                  >
                    Create Channel
                  </button>
                )}
                {canManage && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                    onClick={() => { setShowCreateEvent(true); setShowMenu(false); }}
                  >
                    Create Event
                  </button>
                )}
                <div className="my-1 h-px bg-dc-border" />
                <button
                  className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                  onClick={() => { setShowNotifications(true); setShowMenu(false); }}
                >
                  Notification Settings
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-hover transition-colors"
                  onClick={() => { setShowPrivacy(true); setShowMenu(false); }}
                >
                  Privacy Settings
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-dc-muted hover:text-dc-text hover:bg-dc-hover transition-colors"
                  onClick={handleCopyServerId}
                >
                  Copy Server ID
                </button>
                {currentUserRole !== "OWNER" && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-dc-danger hover:bg-dc-hover transition-colors"
                    onClick={() => { handleLeaveServer(); setShowMenu(false); }}
                  >
                    Leave Server
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          <div className="px-2 mb-3">
            <div className="mb-1 flex items-center justify-between group">
              <span className="text-xs font-semibold text-dc-muted uppercase tracking-wide px-2">
                Events
              </span>
              {canManage && (
                <button
                  onClick={() => setShowCreateEvent(true)}
                  className="text-dc-muted hover:text-dc-text transition-colors opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center font-bold text-base"
                  title="Create Event"
                >
                  +
                </button>
              )}
            </div>
            {events.length === 0 ? (
              <p className="text-dc-muted text-xs px-2 py-1">No upcoming events</p>
            ) : (
              <div className="space-y-1">
                {events.slice(0, 5).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full rounded px-2 py-2 text-left text-dc-muted hover:bg-dc-hover hover:text-dc-text transition-colors"
                  >
                    <p className="truncate text-sm font-semibold text-dc-text">{event.title}</p>
                    <p className="truncate text-xs">
                      {formatShortDate(event.startsAt)} at {formatTime(event.startsAt)}
                    </p>
                    <p className="text-xs text-dc-faint">{event.participantCount ?? 0} interested</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-2 mb-1 flex items-center justify-between group">
            <span className="text-xs font-semibold text-dc-muted uppercase tracking-wide px-2">
              Text Channels
            </span>
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-dc-muted hover:text-dc-text transition-colors opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center font-bold text-base"
                title="Create Channel"
              >
                +
              </button>
            )}
          </div>

          {textChannels.map(renderChannelRow)}

          {textChannels.length === 0 && (
            <p className="text-dc-muted text-xs px-4 py-2">No text channels yet</p>
          )}

          {(voiceChannels.length > 0 || canManage) && (
            <div className="px-2 mt-4 mb-1 flex items-center justify-between group">
              <span className="text-xs font-semibold text-dc-muted uppercase tracking-wide px-2">
                Voice Channels
              </span>
              {canManage && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-dc-muted hover:text-dc-text transition-colors opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center font-bold text-base"
                  title="Create Channel"
                >
                  +
                </button>
              )}
            </div>
          )}

          {voiceChannels.map(renderChannelRow)}

          {orderedCategories.map((cat) => {
            const inCat = channels
              .filter((c) => c.categoryId === cat.id)
              .sort((a, b) => a.position - b.position);
            if (inCat.length === 0) return null;
            const isCollapsed = collapsed.has(cat.id);
            return (
              <div key={cat.id} className="mt-4">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="group flex w-full items-center gap-1 px-2 mb-1 text-dc-muted hover:text-dc-text"
                >
                  <span className={`text-[10px] transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>▼</span>
                  <span className="text-xs font-semibold uppercase tracking-wide">{cat.name}</span>
                </button>
                {!isCollapsed && inCat.map(renderChannelRow)}
              </div>
            );
          })}
        </div>

        {/* User bar */}
        {user && <UserBar user={user} onLogout={logout} />}
      </aside>

      <CreateChannelModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        serverId={server.id}
        onCreated={(ch) => {
          setChannels((prev) =>
            prev.some((c) => c.id === ch.id) ? prev : [...prev, ch].sort((a, b) => a.position - b.position)
          );
          router.push(`/servers/${server.id}/${ch.id}`);
        }}
      />
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        serverId={server.id}
      />
      <ImportDiscordTemplateModal
        open={showImportTemplate}
        onClose={() => setShowImportTemplate(false)}
        serverId={server.id}
        onImported={(importedChannels) => {
          setChannels((prev) => {
            const ids = new Set(prev.map((c) => c.id));
            const fresh = importedChannels.filter((c) => !ids.has(c.id));
            return [...prev, ...fresh].sort((a, b) => a.position - b.position);
          });
          router.refresh();
        }}
      />
      <CreateEventModal
        open={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        serverId={server.id}
        channels={channels}
        onCreated={(event) => {
          setEvents((prev) => {
            if (prev.some((existing) => existing.id === event.id)) return prev;
            return [...prev, event].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
          });
        }}
      />
      <EventDetailsModal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        serverId={server.id}
        event={selectedEvent}
        canManage={canManage}
        onChanged={updateEventState}
      />
      <ServerNotificationSettingsModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        server={server}
      />
      <ServerPrivacySettingsModal
        open={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        server={server}
      />
      {showSettings && (
        <ServerSettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          server={server}
          currentUserRole={currentUserRole}
        />
      )}
      {permsChannel && (
        <ChannelPermissionsModal
          open={Boolean(permsChannel)}
          onClose={() => setPermsChannel(null)}
          channelId={permsChannel.id}
          channelName={permsChannel.name}
        />
      )}
    </>
  );
}
