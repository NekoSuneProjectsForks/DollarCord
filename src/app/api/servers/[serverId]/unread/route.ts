import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: { serverId: string } }

// Per-channel unread + mention counts for the current user in a server.
// A channel is "unread" if its latest message is newer than the user's
// lastReadAt (or they've never read it and it has messages). Mention count is
// the number of mentions addressed to the user since lastReadAt.
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Three batched queries instead of a per-channel N+1: channels, the user's
  // read states, and the latest non-own message time per channel (grouped).
  const [channels, readStates, latestPerChannel, myMentions] = await Promise.all([
    prisma.channel.findMany({ where: { serverId: params.serverId }, select: { id: true } }),
    prisma.channelReadState.findMany({
      where: { userId: user.id, channel: { serverId: params.serverId } },
      select: { channelId: true, lastReadAt: true },
    }),
    prisma.message.groupBy({
      by: ["channelId"],
      where: { channel: { serverId: params.serverId }, deleted: false, userId: { not: user.id }, threadId: null },
      _max: { createdAt: true },
    }),
    prisma.mention.findMany({
      where: { userId: user.id, message: { channel: { serverId: params.serverId }, deleted: false } },
      select: { message: { select: { channelId: true, createdAt: true } } },
    }),
  ]);

  const readMap = new Map(readStates.map((r) => [r.channelId, r.lastReadAt]));
  const latestMap = new Map(latestPerChannel.map((g) => [g.channelId, g._max.createdAt]));

  // Tally mentions newer than each channel's last-read time, in memory.
  const mentionCounts = new Map<string, number>();
  for (const m of myMentions) {
    const lastRead = readMap.get(m.message.channelId);
    if (!lastRead || m.message.createdAt > lastRead) {
      mentionCounts.set(m.message.channelId, (mentionCounts.get(m.message.channelId) ?? 0) + 1);
    }
  }

  const result: Record<string, { unread: boolean; mentions: number }> = {};
  for (const channel of channels) {
    const lastRead = readMap.get(channel.id);
    const latest = latestMap.get(channel.id) ?? null;
    result[channel.id] = {
      unread: Boolean(latest && (!lastRead || latest > lastRead)),
      mentions: mentionCounts.get(channel.id) ?? 0,
    };
  }

  return NextResponse.json({ unread: result });
}
