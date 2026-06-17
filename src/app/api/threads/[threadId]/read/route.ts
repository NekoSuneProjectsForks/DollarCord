import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: { threadId: string } }

// Mark a thread read up to now for the current user.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thread = await prisma.thread.findUnique({
    where: { id: params.threadId },
    include: { channel: { select: { serverId: true } } },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: thread.channel.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  await prisma.threadReadState.upsert({
    where: { threadId_userId: { threadId: params.threadId, userId: user.id } },
    create: { threadId: params.threadId, userId: user.id, lastReadAt: now },
    update: { lastReadAt: now },
  });

  return NextResponse.json({ ok: true });
}
