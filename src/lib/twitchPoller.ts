import { prisma } from "./prisma";
import { getTwitchLiveStatus, twitchConfigured } from "./twitch";
import { broadcastActivities } from "./presence";

// Background poller: periodically checks every user who linked a Twitch channel
// and syncs a "streaming" activity so presence flips to live without the client
// having to ask. No-ops entirely when Twitch credentials aren't configured.

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let started = false;

async function pollOnce(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { twitchChannel: { not: null } },
    select: { id: true, twitchChannel: true },
  });

  for (const user of users) {
    if (!user.twitchChannel) continue;
    try {
      const status = await getTwitchLiveStatus(user.twitchChannel);
      if (!status) continue; // unconfigured / unreachable

      if (status.isLive) {
        await prisma.activity.upsert({
          where: { userId_source: { userId: user.id, source: "twitch" } },
          create: {
            userId: user.id,
            source: "twitch",
            type: "STREAMING",
            name: status.title || "Live on Twitch",
            details: status.category,
            state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
            url: status.url,
            largeImage: status.thumbnailUrl,
            startedAt: status.startedAt ? new Date(status.startedAt) : new Date(),
            expiresAt: new Date(Date.now() + POLL_INTERVAL_MS * 3),
          },
          update: {
            name: status.title || "Live on Twitch",
            details: status.category,
            state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
            url: status.url,
            largeImage: status.thumbnailUrl,
            expiresAt: new Date(Date.now() + POLL_INTERVAL_MS * 3),
          },
        });
        await broadcastActivities(user.id);
      } else {
        const existing = await prisma.activity.findUnique({
          where: { userId_source: { userId: user.id, source: "twitch" } },
        });
        if (existing) {
          await prisma.activity.delete({ where: { id: existing.id } });
          await broadcastActivities(user.id);
        }
      }
    } catch (err) {
      console.error(`[twitchPoller] failed for ${user.twitchChannel}`, err);
    }
  }
}

export function startTwitchPoller(): void {
  if (started || !twitchConfigured()) return;
  started = true;
  // Kick off shortly after boot, then on an interval.
  setTimeout(() => {
    pollOnce().catch((err) => console.error("[twitchPoller]", err));
    setInterval(() => {
      pollOnce().catch((err) => console.error("[twitchPoller]", err));
    }, POLL_INTERVAL_MS);
  }, 10_000);
  console.log("[twitchPoller] started");
}
