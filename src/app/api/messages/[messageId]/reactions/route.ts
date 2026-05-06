import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIO } from "@/server/socketServer";

interface Params { params: { messageId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emoji } = await req.json();
  if (!emoji || typeof emoji !== "string") {
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  }

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reaction = await prisma.reaction.upsert({
    where: { messageId_userId_emoji: { messageId: params.messageId, userId: user.id, emoji } },
    update: {},
    create: { messageId: params.messageId, userId: user.id, emoji },
    include: { user: true },
  });

  const updatedMessage = await prisma.message.findUnique({
    where: { id: params.messageId },
    include: { user: true, bot: true, reactions: { include: { user: true } }, replyTo: { include: { user: true, bot: true } } },
  });

  try {
    getIO().to(`channel:${message.channelId}`).emit("channel:message:update", updatedMessage);
  } catch {}

  return NextResponse.json({ reaction }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emoji = req.nextUrl.searchParams.get("emoji");
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.reaction.deleteMany({
    where: { messageId: params.messageId, userId: user.id, emoji },
  });

  const updatedMessage = await prisma.message.findUnique({
    where: { id: params.messageId },
    include: { user: true, bot: true, reactions: { include: { user: true } }, replyTo: { include: { user: true, bot: true } } },
  });

  try {
    getIO().to(`channel:${message.channelId}`).emit("channel:message:update", updatedMessage);
  } catch {}

  return NextResponse.json({ ok: true });
}
