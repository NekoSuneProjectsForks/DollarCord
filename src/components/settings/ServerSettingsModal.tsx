"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { PERMISSION_LIST, has } from "@/lib/permissionFlags";
import { ServerPlanSection } from "./ServerPlanSection";
import type { Bot, Channel, MemberRole, Server, ServerBan, ServerMember, ServerRole } from "@/types";

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
    liveAnnounceChannelId: server.liveAnnounceChannelId ?? "",
    isPublic: Boolean(server.isPublic),
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [automod, setAutomod] = useState({ enabled: false, blockedWords: "", maxMentions: 0, blockInvites: false });
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [tab, setTab] = useState<"overview" | "members" | "moderation" | "tier" | "danger">("overview");
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
  const [permsRoleId, setPermsRoleId] = useState<string | null>(null);

  async function toggleRolePerm(role: ServerRole, bit: number) {
    const current = role.permissions ?? 0;
    const next = has(current, bit) ? current & ~bit : current | bit;
    const res = await fetch(`/api/servers/${server.id}/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: next }),
    });
    if (res.ok) {
      const d = await res.json();
      setRoles((prev) => prev.map((r) => (r.id === role.id ? d.role : r)));
    }
  }
  const [newBot, setNewBot] = useState({ name: "", username: "", avatarUrl: "" });
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [createdBotToken, setCreatedBotToken] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: server.name,
      description: server.description ?? "",
      iconUrl: server.iconUrl ?? "",
      liveAnnounceChannelId: server.liveAnnounceChannelId ?? "",
      isPublic: Boolean(server.isPublic),
    });
  }, [server]);

  useEffect(() => {
    if (!open || currentUserRole === "MEMBER") return;
    fetch(`/api/servers/${server.id}/automod`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config && setAutomod({
        enabled: Boolean(d.config.enabled),
        blockedWords: d.config.blockedWords ?? "",
        maxMentions: d.config.maxMentions ?? 0,
        blockInvites: Boolean(d.config.blockInvites),
      }))
      .catch(() => {});
  }, [open, server.id, currentUserRole]);

  async function saveAutomod() {
    const res = await fetch(`/api/servers/${server.id}/automod`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(automod),
    });
    if (res.ok) addToast("AutoMod settings saved.", "success");
    else addToast("Failed to save AutoMod.", "error");
  }

  async function applyTemplate(file: File) {
    setApplyingTemplate(true);
    try {
      const text = await file.text();
      const template = JSON.parse(text);
      const res = await fetch(`/api/servers/${server.id}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || "Failed to apply template", "error"); return; }
      addToast(
        `Applied: ${data.createdChannels} channels, ${data.createdCategories} categories, ${data.createdRoles} roles` +
          (data.createdThreads ? `, ${data.createdThreads} threads` : "") +
          ".",
        "success"
      );
      router.refresh();
    } catch {
      addToast("Could not read that template file.", "error");
    } finally {
      setApplyingTemplate(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetch(`/api/servers/${server.id}/channels`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setChannels(data.channels ?? []))
      .catch(() => {});
  }, [open, server.id]);

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
          liveAnnounceChannelId: form.liveAnnounceChannelId || null,
          isPublic: form.isPublic,
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

  const isManager = currentUserRole !== "MEMBER";
  const tabs = [
    { id: "overview" as const, label: "Overview", show: true },
    { id: "members" as const, label: "Roles & Members", show: isManager },
    { id: "moderation" as const, label: "Moderation", show: isManager },
    { id: "tier" as const, label: "Server Tier", show: true },
    { id: "danger" as const, label: "Danger Zone", show: currentUserRole === "OWNER" },
  ].filter((t) => t.show);

  return (
    <Modal open={open} onClose={onClose} title="Server Settings" size="lg">
      <div className="flex gap-5 min-h-[26rem]">
        <nav className="w-40 shrink-0 space-y-0.5 border-r border-dc-border pr-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`block w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-dc-active text-dc-text"
                  : `${t.id === "danger" ? "text-dc-danger" : "text-dc-muted"} hover:bg-dc-hover hover:text-dc-text`
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 max-h-[72vh] overflow-y-auto scrollbar-thin pr-1">
      {tab === "overview" && (
      <form onSubmit={handleSave} className="space-y-4">
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
        <div>
          <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
            Live Announcement Channel
          </label>
          <select
            value={form.liveAnnounceChannelId}
            onChange={(e) => setForm((current) => ({ ...current, liveAnnounceChannelId: e.target.value }))}
            className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
          >
            <option value="">Don&apos;t announce streams</option>
            {channels.filter((c) => (c.type ?? "TEXT") !== "VOICE").map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <p className="text-dc-faint text-xs mt-1">
            When a member who linked a Twitch/Kick channel goes live, a “now live” message is posted here.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-muted">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm((c) => ({ ...c, isPublic: e.target.checked }))}
            className="accent-dc-accent"
          />
          List this server in Discover (anyone can find &amp; join it)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
      )}

      {tab === "tier" && <ServerPlanSection serverId={server.id} isOwner={currentUserRole === "OWNER"} />}

      {tab === "members" && isManager && (
        <div className="space-y-5">
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
                  <div key={role.id} className="bg-dc-chat rounded px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                        <span className="text-sm font-semibold truncate" style={{ color: role.color }}>{role.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPermsRoleId((id) => (id === role.id ? null : role.id))}
                          className="px-3 py-1.5 rounded bg-dc-hover text-xs font-semibold text-dc-text hover:bg-dc-border transition-colors"
                        >
                          {permsRoleId === role.id ? "Hide Perms" : "Permissions"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={roleBusy === role.id}
                          className="px-3 py-1.5 rounded bg-dc-danger/15 text-xs font-semibold text-dc-danger hover:bg-dc-danger/25 disabled:opacity-50 transition-colors"
                        >
                          {roleBusy === role.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    {permsRoleId === role.id && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 border-t border-dc-border pt-2">
                        {PERMISSION_LIST.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-xs text-dc-muted">
                            <input
                              type="checkbox"
                              checked={has(role.permissions ?? 0, p.bit)}
                              onChange={() => toggleRolePerm(role, p.bit)}
                              className="accent-dc-accent"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    )}
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

      {tab === "moderation" && isManager && (
        <div className="space-y-5">
          {/* AutoMod */}
          <div>
            <h3 className="text-dc-text font-semibold mb-2">AutoMod</h3>
            <label className="flex items-center gap-2 text-sm text-dc-muted mb-2">
              <input type="checkbox" checked={automod.enabled} onChange={(e) => setAutomod((a) => ({ ...a, enabled: e.target.checked }))} className="accent-dc-accent" />
              Enable AutoMod
            </label>
            <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1">Blocked words (comma or newline separated)</label>
            <textarea
              value={automod.blockedWords}
              onChange={(e) => setAutomod((a) => ({ ...a, blockedWords: e.target.value }))}
              rows={2}
              className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm resize-none mb-2"
              placeholder="spam, scam, …"
            />
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <label className="text-sm text-dc-muted flex items-center gap-2">
                Max mentions
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={automod.maxMentions}
                  onChange={(e) => setAutomod((a) => ({ ...a, maxMentions: Number(e.target.value) }))}
                  className="w-20 bg-dc-input text-dc-text px-2 py-1 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                />
                <span className="text-xs text-dc-faint">(0 = off)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-dc-muted">
                <input type="checkbox" checked={automod.blockInvites} onChange={(e) => setAutomod((a) => ({ ...a, blockInvites: e.target.checked }))} className="accent-dc-accent" />
                Block invite links
              </label>
            </div>
            <button onClick={saveAutomod} className="px-4 py-2 bg-dc-accent hover:bg-dc-accent-hover text-white text-sm font-semibold rounded transition-colors">
              Save AutoMod
            </button>
          </div>

          {/* Templates */}
          <div className="border-t border-dc-border pt-4">
            <h3 className="text-dc-text font-semibold mb-2">Server Template</h3>
            <p className="text-dc-muted text-sm mb-3">Export this server&apos;s structure (categories, channels, roles) or apply a saved template.</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/servers/${server.id}/export-template`}
                className="px-4 py-2 bg-dc-hover hover:bg-dc-border text-dc-text text-sm font-semibold rounded transition-colors"
              >
                Export Template
              </a>
              <label className="px-4 py-2 bg-dc-hover hover:bg-dc-border text-dc-text text-sm font-semibold rounded transition-colors cursor-pointer">
                {applyingTemplate ? "Applying…" : "Apply Template"}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) applyTemplate(f); e.target.value = ""; }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === "moderation" && isManager && (
        <div className="border-t border-dc-border pt-5 mt-5">
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

      {tab === "danger" && currentUserRole === "OWNER" && (
        <div>
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
        </div>
      </div>
    </Modal>
  );
}
