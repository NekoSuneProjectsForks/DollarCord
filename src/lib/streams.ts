import { prisma } from "./prisma";
import { getTwitchLiveStatus } from "./twitch";
import { getKickLiveStatus } from "./kick";
import { broadcastActivities } from "./presence";
import { tryGetIO } from "@/server/socketServer";
import type { LiveStreamStatus } from "@/types";

const REFRESH_TTL_MS = 6 * 60 * 1000; // activity expiry; refreshed each poll

// Post "X is now live" to every server the streamer is in that has configured a
// live-announce channel. Fired only on an offline→live transition.
async function announceLive(userId: string, status: LiveStreamStatus): Promise<void> {
  const memberships = await prisma.serverMember.findMany({
    where: { userId, server: { liveAnnounceChannelId: { not: null } } },
    select: { server: { select: { id: true, liveAnnounceChannelId: true } } },
  });
  if (memberships.length === 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  const name = user?.displayName ?? "Someone";
  const provider = status.provider === "twitch" ? "Twitch" : "Kick";
  const content = `🔴 **${name}** is now live on ${provider}${status.title ? `: ${status.title}` : ""}\n${status.url}`;

  for (const m of memberships) {
    const channelId = m.server.liveAnnounceChannelId!;
    // Verify the announce channel still belongs to that server.
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, serverId: m.server.id },
      select: { id: true },
    });
    if (!channel) continue;

    const message = await prisma.message.create({
      data: { channelId, userId, content },
      include: { user: true, bot: true, reactions: { include: { user: true } }, replyTo: { include: { user: true, bot: true } } },
    });
    tryGetIO()?.to(`channel:${channelId}`).emit("channel:message", message);
  }
}

async function syncProvider(
  userId: string,
  source: "twitch" | "kick",
  status: LiveStreamStatus | null
): Promise<boolean> {
  if (status === null) return false; // unconfigured / unreachable — leave as-is

  const existing = await prisma.activity.findUnique({
    where: { userId_source: { userId, source } },
  });

  if (status.isLive) {
    const wasLive = Boolean(existing);
    await prisma.activity.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        type: "STREAMING",
        name: status.title || `Live on ${source === "twitch" ? "Twitch" : "Kick"}`,
        details: status.category,
        state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
        url: status.url,
        joinUrl: status.url,
        largeImage: status.thumbnailUrl,
        startedAt: status.startedAt ? new Date(status.startedAt) : new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
      update: {
        name: status.title || `Live on ${source === "twitch" ? "Twitch" : "Kick"}`,
        details: status.category,
        state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
        url: status.url,
        joinUrl: status.url,
        largeImage: status.thumbnailUrl,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    if (!wasLive) {
      await announceLive(userId, status).catch((err) => console.error("[streams] announce failed", err));
      return true;
    }
    return false;
  }

  if (existing) await prisma.activity.delete({ where: { id: existing.id } });
  return false;
}

/**
 * Refresh a user's Twitch + Kick streaming activities. Returns the live status
 * for each linked provider. Broadcasts presence + fires announcements as needed.
 */
export async function syncUserStreams(
  userId: string,
  channels: { twitchChannel?: string | null; kickChannel?: string | null }
): Promise<{ twitch: LiveStreamStatus | null; kick: LiveStreamStatus | null }> {
  const [twitch, kick] = await Promise.all([
    channels.twitchChannel ? getTwitchLiveStatus(channels.twitchChannel) : Promise.resolve(null),
    channels.kickChannel ? getKickLiveStatus(channels.kickChannel) : Promise.resolve(null),
  ]);

  let changed = false;
  if (twitch) changed = (await syncProvider(userId, "twitch", twitch)) || changed;
  if (kick) changed = (await syncProvider(userId, "kick", kick)) || changed;

  await broadcastActivities(userId);
  return { twitch, kick };
}
