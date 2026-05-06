"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate } from "@/lib/dateTime";
import type { User } from "@/types";

interface Props { user: User }

export function UserSettingsPage({ user }: Props) {
  const router = useRouter();
  const { setUser, logout } = useAuth();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    displayName: user.displayName,
    bio: user.bio ?? "",
    avatarUrl: user.avatarUrl ?? "",
    twitchChannel: user.twitchChannel ?? "",
    kickChannel: user.kickChannel ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName || undefined,
          bio: form.bio || null,
          avatarUrl: form.avatarUrl || null,
          twitchChannel: form.twitchChannel || null,
          kickChannel: form.kickChannel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Update failed", "error");
        return;
      }
      setUser(data.user);
      addToast("Profile updated!", "success");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const preview = { ...user, ...form, avatarUrl: form.avatarUrl || null };

  return (
    <div className="flex flex-1 overflow-hidden bg-dc-chat">
      <div className="w-56 bg-dc-sidebar border-r border-dc-border p-4 shrink-0">
        <p className="text-dc-muted text-xs font-semibold uppercase tracking-wide mb-2 px-2">User Settings</p>
        {(["profile", "account"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? "bg-dc-active text-dc-text" : "text-dc-muted hover:text-dc-text hover:bg-dc-hover"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="mt-4 border-t border-dc-border pt-4">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded text-sm text-dc-danger hover:bg-dc-hover transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {activeTab === "profile" && (
            <>
              <h2 className="text-dc-text text-xl font-bold mb-6">My Profile</h2>

              <div className="bg-dc-sidebar rounded-lg p-4 mb-6 flex items-center gap-4">
                <Avatar user={preview} size="lg" />
                <div>
                  <p className="text-dc-text font-semibold">{preview.displayName || "Display Name"}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-dc-muted text-sm">@{user.username}</p>
                    {user.isPlatformAdmin && (
                      <span className="rounded-full bg-dc-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
                        DollarCord Admin
                      </span>
                    )}
                  </div>
                  {preview.bio && <p className="text-dc-muted text-sm mt-1">{preview.bio}</p>}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                    maxLength={64}
                    className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
                    Bio
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    maxLength={256}
                    rows={3}
                    className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm resize-none"
                    placeholder="Tell others a bit about yourself"
                  />
                  <p className="text-dc-faint text-xs mt-1">{form.bio.length}/256</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(e) => update("avatarUrl", e.target.value)}
                    className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
                      Twitch Channel
                    </label>
                    <input
                      type="text"
                      value={form.twitchChannel}
                      onChange={(e) => update("twitchChannel", e.target.value)}
                      maxLength={25}
                      className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                      placeholder="channelname"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-dc-muted uppercase tracking-wide mb-1.5">
                      Kick Channel
                    </label>
                    <input
                      type="text"
                      value={form.kickChannel}
                      onChange={(e) => update("kickChannel", e.target.value)}
                      maxLength={25}
                      className="w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm"
                      placeholder="channelname"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </>
          )}

          {activeTab === "account" && (
            <>
              <h2 className="text-dc-text text-xl font-bold mb-6">Account</h2>
              <div className="bg-dc-sidebar rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Email</p>
                  <p className="text-dc-text text-sm">{user.email}</p>
                </div>
                <div>
                  <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Username</p>
                  <p className="text-dc-text text-sm">@{user.username}</p>
                </div>
                <div>
                  <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Member Since</p>
                  <p className="text-dc-text text-sm">{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <p className="text-dc-muted text-xs uppercase tracking-wide font-semibold mb-1">Platform Role</p>
                  <p className="text-dc-text text-sm">{user.isPlatformAdmin ? "DollarCord Admin" : "User"}</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-dc-danger/10 rounded-lg border border-dc-danger/20">
                <h3 className="text-dc-danger font-semibold mb-1">Danger Zone</h3>
                <p className="text-dc-muted text-sm mb-3">Once you log out, you&apos;ll need to sign in again.</p>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-dc-danger hover:bg-dc-danger-hover text-white text-sm font-semibold rounded transition-colors"
                >
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
