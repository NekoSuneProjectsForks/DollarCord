import { prisma } from "./prisma";
import { syncUserStreams } from "./streams";

// Background poller: every few minutes, refresh the streaming presence of every
// user who linked a Twitch or Kick channel, and fire "now live" announcements
// on offline→live transitions. No-ops gracefully when providers are
// unconfigured/unreachable (those statuses come back null and are skipped).

const POLL_INTERVAL_MS = 2 * 60 * 1000;
let started = false;

async function pollOnce(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { OR: [{ twitchChannel: { not: null } }, { kickChannel: { not: null } }] },
    select: { id: true, twitchChannel: true, kickChannel: true },
  });

  for (const user of users) {
    try {
      await syncUserStreams(user.id, { twitchChannel: user.twitchChannel, kickChannel: user.kickChannel });
    } catch (err) {
      console.error(`[streamPoller] failed for user ${user.id}`, err);
    }
  }
}

export function startStreamPoller(): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    pollOnce().catch((err) => console.error("[streamPoller]", err));
    setInterval(() => {
      pollOnce().catch((err) => console.error("[streamPoller]", err));
    }, POLL_INTERVAL_MS);
  }, 10_000);
  console.log("[streamPoller] started");
}
