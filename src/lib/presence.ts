import { prisma } from "./prisma";
import { tryGetIO } from "@/server/socketServer";
import type { Activity as PrismaActivity } from "@prisma/client";

export interface ActivityDTO {
  id: string;
  source: string;
  type: string;
  name: string;
  details: string | null;
  state: string | null;
  url: string | null;
  largeImage: string | null;
  smallImage: string | null;
  startedAt: string | null;
  joinUrl: string | null;
  partyCurrent: number | null;
  partyMax: number | null;
}

export function serializeActivity(a: PrismaActivity): ActivityDTO {
  return {
    id: a.id,
    source: a.source,
    type: a.type,
    name: a.name,
    details: a.details,
    state: a.state,
    url: a.url,
    largeImage: a.largeImage,
    smallImage: a.smallImage,
    startedAt: a.startedAt ? a.startedAt.toISOString() : null,
    joinUrl: a.joinUrl,
    partyCurrent: a.partyCurrent,
    partyMax: a.partyMax,
  };
}

/** Drop activities whose expiry has passed (e.g. stale Twitch/RPC pushes). */
async function pruneExpired(userId: string): Promise<void> {
  await prisma.activity.deleteMany({
    where: { userId, expiresAt: { not: null, lt: new Date() } },
  });
}

export async function getUserActivities(userId: string): Promise<ActivityDTO[]> {
  await pruneExpired(userId);
  const rows = await prisma.activity.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(serializeActivity);
}

/** Push the user's current activities to every connected client. */
export async function broadcastActivities(userId: string): Promise<void> {
  const activities = await getUserActivities(userId);
  tryGetIO()?.emit("presence:activity", { userId, activities });
}

export function broadcastStatus(userId: string, status: string): void {
  tryGetIO()?.emit("presence:status", { userId, status });
}

// Record a game/app sighting into the rolling history (NOT streaming). Upserts by
// (userId, name) and bumps lastSeenAt; powers the profile "Recent activity" tab.
export async function recordActivityHistory(
  userId: string,
  a: { type: string; name: string; largeImage?: string | null; details?: string | null }
): Promise<void> {
  if (a.type === "STREAMING" || a.type === "CUSTOM" || !a.name?.trim()) return;
  const now = new Date();
  try {
    await prisma.activityHistory.upsert({
      where: { userId_name: { userId, name: a.name } },
      create: { userId, type: a.type, name: a.name, largeImage: a.largeImage ?? null, details: a.details ?? null, lastSeenAt: now },
      update: { type: a.type, largeImage: a.largeImage ?? null, details: a.details ?? null, lastSeenAt: now },
    });
  } catch {
    /* history is best-effort */
  }
}

export interface ActivityHistoryDTO {
  id: string;
  type: string;
  name: string;
  largeImage: string | null;
  details: string | null;
  lastSeenAt: string;
}

export async function getRecentActivity(userId: string): Promise<ActivityHistoryDTO[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.activityHistory.findMany({
    where: { userId, lastSeenAt: { gt: since } },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id, type: r.type, name: r.name, largeImage: r.largeImage, details: r.details,
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}
