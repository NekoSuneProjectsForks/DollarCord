import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MESSAGE_INCLUDE } from "@/lib/messages";
import { getIO } from "@/server/socketServer";

interface Params { params: { pollId: string } }

// Cast (or toggle) a vote. Single-choice polls replace the prior vote.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const optionId = typeof body.optionId === "string" ? body.optionId : null;
  if (!optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 });

  const poll = await prisma.poll.findUnique({
    where: { id: params.pollId },
    include: { options: true, message: { select: { channelId: true, channel: { select: { serverId: true } } } } },
  });
  if (!poll || !poll.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Poll or option not found" }, { status: 404 });
  }
  if (poll.closesAt && poll.closesAt < new Date()) {
    return NextResponse.json({ error: "This poll is closed" }, { status: 400 });
  }

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: poll.message.channel.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.pollVote.findFirst({ where: { pollId: poll.id, optionId, userId: user.id } });
  if (existing) {
    await prisma.pollVote.delete({ where: { id: existing.id } }); // toggle off
  } else {
    if (!poll.multiple) {
      await prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId: user.id } }); // single choice
    }
    await prisma.pollVote.create({ data: { pollId: poll.id, optionId, userId: user.id } });
  }

  // Re-emit the message so clients refresh the poll tallies.
  const message = await prisma.message.findUnique({ where: { id: poll.messageId }, include: MESSAGE_INCLUDE });
  try { getIO().to(`channel:${poll.message.channelId}`).emit("channel:message:update", message); } catch {}
  return NextResponse.json({ message });
}
