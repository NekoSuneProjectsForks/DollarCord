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
