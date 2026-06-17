import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: { channelId: string } }

// Mark a channel as read up to now for the current user.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({
    where: { id: params.channelId },
    select: { serverId: true },
  });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  await prisma.channelReadState.upsert({
    where: { channelId_userId: { channelId: params.channelId, userId: user.id } },
    create: { channelId: params.channelId, userId: user.id, lastReadAt: now },
    update: { lastReadAt: now },
  });

  return NextResponse.json({ ok: true });
}
