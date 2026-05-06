import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIO } from "@/server/socketServer";

interface Params { params: { channelId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pins = await prisma.pinnedMessage.findMany({
    where: { channelId: params.channelId },
    include: { message: { include: { user: true, bot: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pins: pins.map((p) => p.message).filter((message) => !message.deleted) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { messageId } = await req.json();
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const message = await prisma.message.findFirst({
    where: { id: messageId, channelId: params.channelId, deleted: false },
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const pin = await prisma.pinnedMessage.upsert({
    where: { channelId_messageId: { channelId: params.channelId, messageId } },
    update: {},
    create: { channelId: params.channelId, messageId, pinnedBy: user.id },
  });

  try {
    getIO().to(`channel:${params.channelId}`).emit("channel:pins:update");
  } catch {}

  return NextResponse.json({ pin }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  await prisma.pinnedMessage.deleteMany({
    where: { channelId: params.channelId, messageId },
  });

  try {
    getIO().to(`channel:${params.channelId}`).emit("channel:pins:update");
  } catch {}

  return NextResponse.json({ ok: true });
}
