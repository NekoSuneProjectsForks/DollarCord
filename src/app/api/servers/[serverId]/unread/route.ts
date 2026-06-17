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

  const channels = await prisma.channel.findMany({
    where: { serverId: params.serverId },
    select: { id: true },
  });

  const readStates = await prisma.channelReadState.findMany({
    where: { userId: user.id, channel: { serverId: params.serverId } },
    select: { channelId: true, lastReadAt: true },
  });
  const readMap = new Map(readStates.map((r) => [r.channelId, r.lastReadAt]));

  const result: Record<string, { unread: boolean; mentions: number }> = {};

  await Promise.all(
    channels.map(async (channel) => {
      const lastRead = readMap.get(channel.id);

      const latest = await prisma.message.findFirst({
        where: { channelId: channel.id, deleted: false, userId: { not: user.id } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const unread = Boolean(latest && (!lastRead || latest.createdAt > lastRead));

      const mentions = await prisma.mention.count({
        where: {
          userId: user.id,
          message: {
            channelId: channel.id,
            deleted: false,
            ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
          },
        },
      });

      result[channel.id] = { unread, mentions };
    })
  );

  return NextResponse.json({ unread: result });
}
