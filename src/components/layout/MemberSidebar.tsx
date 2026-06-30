"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfileModal } from "@/components/modals/UserProfileModal";
import { canBanMember, canChangeRole, canRemoveMember } from "@/lib/serverPermissions";
import { effectiveStatus, isShownOnline } from "@/lib/presenceStatus";
import type { MemberRole, ServerMember } from "@/types";

interface Props {
  members: ServerMember[];
  serverId: string;
  currentUserId: string;
  currentUserRole: MemberRole;
}

const roleLabel = { OWNER: "Owner", ADMIN: "Admins", MEMBER: "Members" };
const roleWeight: Record<MemberRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

function sortMembers(members: ServerMember[]) {
  return [...members].sort(
    (left, right) =>
      roleWeight[left.role] - roleWeight[right.role] ||
      +new Date(left.joinedAt) - +new Date(right.joinedAt)
  );
}

function groupByRole(members: ServerMember[]) {
  const groups: Record<MemberRole, ServerMember[]> = { OWNER: [], ADMIN: [], MEMBER: [] };
  for (const member of members) groups[member.role]?.push(member);
  return groups;
}

const ACTIVITY_VERB: Record<string, string> = {
  PLAYING: "Playing",
  STREAMING: "Streaming",
  LISTENING: "Listening to",
  WATCHING: "Watching",
  COMPETING: "Competing in",
  CUSTOM: "",
};

export function MemberSidebar({ members, serverId, currentUserId, currentUserRole }: Props) {
  const { presence, socket, statuses, activities } = useSocket();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [memberList, setMemberList] = useState(sortMembers(members));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ statuses: typeof statuses; activities: typeof activities }>({
    statuses: {},
    activities: {},
  });

  useEffect(() => {
    setMemberList(sortMembers(members));
  }, [members]);

  // Seed statuses/activities once for the current member set; live socket
  // events take precedence afterwards.
  useEffect(() => {
    const ids = members.map((m) => m.userId).join(",");
    if (!ids) return;
    fetch(`/api/presence?userIds=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSeed({ statuses: data.statuses ?? {}, activities: data.activities ?? {} }))
      .catch(() => {});
  }, [members]);

  useEffect(() => {
    if (!socket) return;

    const refreshMembers = async () => {
      const res = await fetch(`/api/servers/${serverId}/members`);
      if (!res.ok) return;
      const data = await res.json();
      setMemberList(sortMembers(data.members ?? []));
    };

    socket.on("server:members:update", refreshMembers);
    return () => {
      socket.off("server:members:update", refreshMembers);
    };
  }, [serverId, socket]);

  async function updateRole(target: ServerMember, role: "ADMIN" | "MEMBER") {
    const busy = `${target.userId}:role:${role}`;
    setBusyKey(busy);
    try {
      const res = await fetch(`/api/servers/${serverId}/members?userId=${target.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to update role", "error");
        return;
      }

      setMemberList((prev) =>
        sortMembers(prev.map((member) => (member.userId === target.userId ? { ...member, role } : member)))
      );
      addToast(`${target.user.displayName} is now ${role === "ADMIN" ? "an admin" : "a member"}.`, "success");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMember(target: ServerMember, action: "kick" | "ban") {
    const verb = action === "ban" ? "ban" : "kick";
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${target.user.displayName}?`)) return;

    const busy = `${target.userId}:${action}`;
    setBusyKey(busy);
    try {
      const endpoint = action === "ban" ? `/api/servers/${serverId}/bans` : `/api/servers/${serverId}/members?userId=${target.userId}`;
      const options =
        action === "ban"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetUserId: target.userId }),
            }
          : {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kick: true }),
            };

      const res = await fetch(endpoint, options);
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || `Failed to ${action} member`, "error");
        return;
      }

      setMemberList((prev) => prev.filter((member) => member.userId !== target.userId));
      addToast(`${target.user.displayName} was ${action === "ban" ? "banned" : "kicked"}.`, "success");
    } finally {
      setBusyKey(null);
    }
  }

  const filtered = memberList.filter(
    (member) =>
      member.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
      member.user.username.toLowerCase().includes(search.toLowerCase())
  );

  const groups = groupByRole(filtered);
  const onlineCount = memberList.filter((member) =>
    isShownOnline(
      effectiveStatus({
        connected: presence[member.userId] ?? false,
        chosenStatus: statuses[member.userId]?.status ?? seed.statuses[member.userId]?.status,
        self: member.userId === currentUserId,
      })
    )
  ).length;

  return (
    <aside className="w-60 bg-dc-sidebar border-l border-dc-border flex flex-col shrink-0 overflow-hidden">
      <div className="px-3 py-3 border-b border-dc-border">
        <input
          type="text"
          placeholder="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-dc-input text-dc-text text-sm px-3 py-1.5 rounded border border-dc-border focus:border-dc-accent focus:outline-none placeholder-dc-muted"
        />
        <p className="text-dc-muted text-xs mt-2 px-1">
          {memberList.length} member{memberList.length !== 1 ? "s" : ""}
          {onlineCount > 0 && ` - ${onlineCount} online`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
        {(["OWNER", "ADMIN", "MEMBER"] as const).map((role) => {
          const group = groups[role];
          if (!group || group.length === 0) return null;

          return (
            <div key={role} className="mb-3">
              <p className="text-xs font-semibold text-dc-muted uppercase tracking-wide px-2 mb-1">
                {roleLabel[role]} - {group.length}
              </p>
              {group.map((member) => {
                const connected = presence[member.userId] ?? false;
                const memberStatus = statuses[member.userId]?.status ?? seed.statuses[member.userId]?.status;
                const customStatus = statuses[member.userId]?.customStatus ?? seed.statuses[member.userId]?.customStatus;
                const memberActivity = (activities[member.userId] ?? seed.activities[member.userId])?.[0];
                const subtitle = memberActivity
                  ? memberActivity.type === "CUSTOM"
                    ? memberActivity.name
                    : `${ACTIVITY_VERB[memberActivity.type] ?? "Playing"} ${memberActivity.name}`
                  : customStatus || null;
                const isSelf = member.userId === currentUserId;
                const shownStatus = effectiveStatus({ connected, chosenStatus: memberStatus, self: isSelf });
                const online = isShownOnline(shownStatus);
                const canPromote = !isSelf && canChangeRole(currentUserRole, member.role) && member.role === "MEMBER";
                const canDemote = !isSelf && canChangeRole(currentUserRole, member.role) && member.role === "ADMIN";
                const canKick = !isSelf && canRemoveMember(currentUserRole, member.role);
                const canBan = !isSelf && canBanMember(currentUserRole, member.role);

                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedUserId(member.userId)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dc-hover transition-colors group cursor-pointer"
                  >
                    <Avatar user={member.user} size="sm" online={online} status={shownStatus} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${online ? "text-dc-text" : "text-dc-muted"}`}>
                        {member.user.displayName}
                      </p>
                      {subtitle ? (
                        <p className="text-xs text-dc-faint truncate" title={subtitle}>{subtitle}</p>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="text-xs text-dc-faint truncate">@{member.user.username}</p>
                          {(member.user.twitchChannel || member.user.kickChannel) && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
                              Stream
                            </span>
                          )}
                        </div>
                      )}
                      {member.roles && member.roles.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.roles.slice(0, 2).map(({ role }) => (
                            <span
                              key={role.id}
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                              style={{ color: role.color, backgroundColor: `${role.color}1A` }}
                            >
                              {role.name}
                            </span>
                          ))}
                          {member.roles.length > 2 && (
                            <span className="text-[10px] text-dc-faint">+{member.roles.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {role === "OWNER" && (
                      <span className="shrink-0 text-xs text-dc-warning" title="Server Owner">Owner</span>
                    )}
                    {role === "ADMIN" && (
                      <span className="shrink-0 text-xs text-dc-accent" title="Admin">Admin</span>
                    )}
                    {(canPromote || canDemote || canKick || canBan) && (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        {canPromote && (
                          <button
                            onClick={(event) => { event.stopPropagation(); updateRole(member, "ADMIN"); }}
                            disabled={busyKey === `${member.userId}:role:ADMIN`}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-dc-accent/15 text-dc-accent hover:bg-dc-accent/25 disabled:opacity-50 transition-colors"
                          >
                            Promote
                          </button>
                        )}
                        {canDemote && (
                          <button
                            onClick={(event) => { event.stopPropagation(); updateRole(member, "MEMBER"); }}
                            disabled={busyKey === `${member.userId}:role:MEMBER`}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-dc-hover text-dc-text hover:bg-dc-border disabled:opacity-50 transition-colors"
                          >
                            Demote
                          </button>
                        )}
                        {canKick && (
                          <button
                            onClick={(event) => { event.stopPropagation(); removeMember(member, "kick"); }}
                            disabled={busyKey === `${member.userId}:kick`}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-dc-warning/15 text-dc-warning hover:bg-dc-warning/25 disabled:opacity-50 transition-colors"
                          >
                            Kick
                          </button>
                        )}
                        {canBan && (
                          <button
                            onClick={(event) => { event.stopPropagation(); removeMember(member, "ban"); }}
                            disabled={busyKey === `${member.userId}:ban`}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-dc-danger/15 text-dc-danger hover:bg-dc-danger/25 disabled:opacity-50 transition-colors"
                          >
                            Ban
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-dc-muted text-xs px-2">No members found</p>
        )}
      </div>
      <UserProfileModal
        open={Boolean(selectedUserId)}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId}
        serverId={serverId}
      />
    </aside>
  );
}
