"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import type { Bot, MemberRole, Server, ServerBan, ServerMember, ServerRole } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  server: Server;
  currentUserRole: MemberRole;
}

export function ServerSettingsModal({ open, onClose, server, currentUserRole }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    name: server.name,
    description: server.description ?? "",
    iconUrl: server.iconUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loadingManagement, setLoadingManagement] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", color: "#7c6af7" });
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [newBot, setNewBot] = useState({ name: "", username: "", avatarUrl: "" });
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [createdBotToken, setCreatedBotToken] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: server.name,
      description: server.description ?? "",
      iconUrl: server.iconUrl ?? "",
    });
  }, [server]);

  useEffect(() => {
    if (!open || currentUserRole === "MEMBER") return;
    setLoadingBans(true);
    fetch(`/api/servers/${server.id}/bans`)
      .then((res) => res.json())
      .then((data) => setBans(data.bans ?? []))
      .finally(() => setLoadingBans(false));
  }, [open, server.id, currentUserRole]);

  useEffect(() => {
    if (!open || currentUserRole === "MEMBER") return;
    setLoadingManagement(true);
    Promise.all([
      fetch(`/api/servers/${server.id}/roles`).then((res) => res.json()),
      fetch(`/api/servers/${server.id}/members`).then((res) => res.json()),
      fetch(`/api/servers/${server.id}/bots`).then((res) => res.json()),
    ])
      .then(([rolesData, membersData, botsData]) => {
        setRoles(rolesData.roles ?? []);
        setMembers(membersData.members ?? []);
        setBots(botsData.bots ?? []);
      })
      .finally(() => setLoadingManagement(false));
  }, [open, server.id, currentUserRole]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          description: form.description || null,
          iconUrl: form.iconUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Update failed", "error");
        return;
      }
      addToast("Server updated!", "success");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (confirmDelete !== server.name) {
      addToast("Server name doesn't match", "error");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/servers/${server.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || "Delete failed", "error");
        return;
      }
      addToast("Server deleted", "info");
      onClose();
      router.push("/channels");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnban(userId: string) {
    setUnbanningUserId(userId);
    try {
      const res = await fetch(`/api/servers/${server.id}/bans?userId=${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data.error || "Failed to unban user", "error");
        return;
      }

      setBans((prev) => prev.filter((ban) => ban.userId !== userId));
      addToast("User unbanned.", "success");
    } finally {
      setUnbanningUserId(null);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRole.name.trim()) return;
    setRoleBusy("create");
    try {
      const res = await fetch(`/api/servers/${server.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to create role", "error");
        return;
      }
      setRoles((prev) => [...prev, data.role]);
      setNewRole({ name: "", color: "#7c6af7" });
      addToast("Role created.", "success");
    } finally {
      setRoleBusy(null);
    }
  }

  async function handleDeleteRole(roleId: string) {
    setRoleBusy(roleId);
    try {
      const res = await fetch(`/api/servers/${server.id}/roles/${roleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data.error || "Failed to delete role", "error");
        return;
      }
      setRoles((prev) => prev.filter((role) => role.id !== roleId));
      setMembers((prev) =>
        prev.map((member) => ({
          ...member,
          roles: member.roles?.filter((entry) => entry.roleId !== roleId),
        }))
      );
      addToast("Role deleted.", "info");
    } finally {
      setRoleBusy(null);
    }
  }

  async function handleAssignRole(member: ServerMember, roleId: string, checked: boolean) {
    const currentRoleIds = new Set((member.roles ?? []).map((entry) => entry.roleId));
    if (checked) currentRoleIds.add(roleId);
    else currentRoleIds.delete(roleId);

    const busy = `${member.userId}:${roleId}`;
    setRoleBusy(busy);
    try {
      const res = await fetch(`/api/servers/${server.id}/members/${member.userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: Array.from(currentRoleIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to assign role", "error");
        return;
      }
      setMembers((prev) => prev.map((entry) => (entry.userId === member.userId ? data.member : entry)));
    } finally {
      setRoleBusy(null);
    }
  }

  async function handleCreateBot(e: React.FormEvent) {
    e.preventDefault();
    if (!newBot.name.trim() || !newBot.username.trim()) return;
    setBotBusy("create");
    setCreatedBotToken(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBot.name,
          username: newBot.username,
          avatarUrl: newBot.avatarUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to create bot", "error");
        return;
      }
      setBots((prev) => [data.bot, ...prev]);
      setCreatedBotToken(data.token);
      setNewBot({ name: "", username: "", avatarUrl: "" });
      addToast("Bot created.", "success");
    } finally {
      setBotBusy(null);
    }
  }

  async function handleDeleteBot(botId: string) {
    setBotBusy(botId);
    try {
      const res = await fetch(`/api/servers/${server.id}/bots/${botId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data.error || "Failed to delete bot", "error");
        return;
      }
      setBots((prev) => prev.filter((bot) => bot.id !== botId));
      addToast("Bot deleted.", "info");
    } finally {
      setBotBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Server Settings" size="lg">
      <form onSubmit={handleSave} className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Server Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            maxLength={100}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            maxLength={500}
            rows={2}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">Icon URL</label>
          <input
            type="url"
            value={form.iconUrl}
            onChange={(e) => setForm((current) => ({ ...current, iconUrl: e.target.value }))}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
            placeholder="https://example.com/icon.png"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {currentUserRole !== "MEMBER" && (
        <div className="border-t border-dc-border pt-5 mb-6 space-y-5">
          <div>
            <h3 className="text-dc-text font-semibold mb-2">Custom Roles</h3>
            <form onSubmit={handleCreateRole} className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                type="text"
                value={newRole.name}
                onChange={(e) => setNewRole((current) => ({ ...current, name: e.target.value }))}
                maxLength={32}
                className="flex-1 bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                placeholder="Role name"
              />
              <input
                type="color"
                value={newRole.color}
                onChange={(e) => setNewRole((current) => ({ ...current, color: e.target.value }))}
                className="h-10 w-14 rounded border border-dc-border bg-dc-input p-1"
                title="Role color"
              />
              <button
                type="submit"
                disabled={roleBusy === "create" || !newRole.name.trim()}
                className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
              >
                {roleBusy === "create" ? "Creating..." : "Create Role"}
              </button>
            </form>

            {loadingManagement ? (
              <p className="text-dc-muted text-sm">Loading roles...</p>
            ) : roles.length === 0 ? (
              <p className="text-dc-muted text-sm">No custom roles yet.</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between gap-3 bg-dc-chat rounded px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                      <span className="text-sm font-semibold truncate" style={{ color: role.color }}>{role.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(role.id)}
                      disabled={roleBusy === role.id}
                      className="px-3 py-1.5 rounded bg-dc-danger/15 text-xs font-semibold text-dc-danger hover:bg-dc-danger/25 disabled:opacity-50 transition-colors"
                    >
                      {roleBusy === role.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {roles.length > 0 && (
            <div>
              <h3 className="text-dc-text font-semibold mb-2">Assign Roles</h3>
              <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-2 pr-1">
                {members.map((member) => (
                  <div key={member.id} className="bg-dc-chat rounded px-3 py-2">
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-dc-text truncate">{member.user.displayName}</p>
                      <p className="text-xs text-dc-muted truncate">@{member.user.username}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => {
                        const checked = Boolean(member.roles?.some((entry) => entry.roleId === role.id));
                        const busy = roleBusy === `${member.userId}:${role.id}`;
                        return (
                          <label
                            key={role.id}
                            className="inline-flex items-center gap-1.5 rounded border border-dc-border bg-dc-input px-2 py-1 text-xs text-dc-text"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              onChange={(e) => handleAssignRole(member, role.id, e.target.checked)}
                              className="accent-dc-accent"
                            />
                            <span style={{ color: role.color }}>{role.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-dc-text font-semibold mb-2">Bots</h3>
            <form onSubmit={handleCreateBot} className="space-y-2 mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newBot.name}
                  onChange={(e) => setNewBot((current) => ({ ...current, name: e.target.value }))}
                  maxLength={64}
                  className="bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                  placeholder="Bot display name"
                />
                <input
                  type="text"
                  value={newBot.username}
                  onChange={(e) => setNewBot((current) => ({ ...current, username: e.target.value }))}
                  maxLength={32}
                  className="bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                  placeholder="bot-username"
                />
              </div>
              <input
                type="url"
                value={newBot.avatarUrl}
                onChange={(e) => setNewBot((current) => ({ ...current, avatarUrl: e.target.value }))}
                className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                placeholder="https://example.com/bot-avatar.png"
              />
              <button
                type="submit"
                disabled={botBusy === "create" || !newBot.name.trim() || !newBot.username.trim()}
                className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
              >
                {botBusy === "create" ? "Creating..." : "Create Bot"}
              </button>
            </form>

            {createdBotToken && (
              <div className="mb-3 rounded border border-dc-warning/30 bg-dc-warning/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-dc-warning mb-1">New Bot Token</p>
                <code className="block break-all rounded bg-dc-input px-2 py-1 text-xs text-dc-text">{createdBotToken}</code>
                <p className="mt-2 text-xs text-dc-muted">
                  Use this as a Bearer token with POST /api/bot/messages and a JSON body containing channelId and content.
                </p>
              </div>
            )}

            {bots.length === 0 ? (
              <p className="text-dc-muted text-sm">No bots yet.</p>
            ) : (
              <div className="space-y-2">
                {bots.map((bot) => (
                  <div key={bot.id} className="flex items-center justify-between gap-3 bg-dc-chat rounded px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dc-text truncate">{bot.name}</p>
                      <p className="text-xs text-dc-muted truncate">@{bot.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBot(bot.id)}
                      disabled={botBusy === bot.id}
                      className="px-3 py-1.5 rounded bg-dc-danger/15 text-xs font-semibold text-dc-danger hover:bg-dc-danger/25 disabled:opacity-50 transition-colors"
                    >
                      {botBusy === bot.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {currentUserRole !== "MEMBER" && (
        <div className="border-t border-dc-border pt-5 mb-6">
          <h3 className="text-dc-text font-semibold mb-2">Banned Users</h3>
          {loadingBans ? (
            <p className="text-dc-muted text-sm">Loading bans...</p>
          ) : bans.length === 0 ? (
            <p className="text-dc-muted text-sm">No banned users.</p>
          ) : (
            <div className="space-y-2">
              {bans.map((ban) => (
                <div key={ban.id} className="flex items-center justify-between gap-3 bg-dc-chat rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-dc-text text-sm font-semibold truncate">{ban.user.displayName}</p>
                    <p className="text-dc-muted text-xs truncate">@{ban.user.username}</p>
                    {ban.reason && <p className="text-dc-faint text-xs mt-1 truncate">Reason: {ban.reason}</p>}
                  </div>
                  <button
                    onClick={() => handleUnban(ban.userId)}
                    disabled={unbanningUserId === ban.userId}
                    className="px-3 py-1.5 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
                  >
                    {unbanningUserId === ban.userId ? "Unbanning..." : "Unban"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentUserRole === "OWNER" && (
        <div className="border-t border-dc-border pt-5">
          <h3 className="text-dc-danger font-semibold mb-2">Delete Server</h3>
          <p className="text-dc-muted text-sm mb-3">
            This is irreversible. All channels, messages, and members will be permanently deleted. Type <span className="font-mono text-dc-text">{server.name}</span> to confirm.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={server.name}
              className="flex-1 bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-danger focus:outline-none text-sm"
            />
            <button
              onClick={handleDelete}
              disabled={deleting || confirmDelete !== server.name}
              className="px-4 py-2 bg-dc-danger hover:bg-dc-danger-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
