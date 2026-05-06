import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editMessageSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { messageId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const message = await prisma.message.findUnique({
    where: { id: params.messageId },
    include: { user: true, bot: true, reactions: { include: { user: true } }, replyTo: { include: { user: true, bot: true } } },
  });
  if (!message || message.deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.botId) return NextResponse.json({ error: "Bot messages cannot be edited here" }, { status: 403 });
  if (message.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const updated = await prisma.message.update({
    where: { id: params.messageId },
    data: { content: parsed.data.content, edited: true },
    include: { user: true, bot: true, reactions: { include: { user: true } }, replyTo: { include: { user: true, bot: true } } },
  });

  try {
    getIO().to(`channel:${message.channelId}`).emit("channel:message:update", updated);
  } catch {}

  return NextResponse.json({ message: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const message = await prisma.message.findUnique({
    where: { id: params.messageId },
    include: { channel: { include: { server: true } } },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Author or admin/owner can delete
  const canDelete = message.userId === user.id;
  let isAdmin = false;
  if (!canDelete) {
    const member = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: message.channel.serverId, userId: user.id } },
    });
    isAdmin = Boolean(member && ["OWNER", "ADMIN"].includes(member.role));
  }

  if (!canDelete && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete
  await prisma.$transaction([
    prisma.message.update({
      where: { id: params.messageId },
      data: { deleted: true, content: "" },
    }),
    prisma.pinnedMessage.deleteMany({
      where: { messageId: params.messageId },
    }),
  ]);

  try {
    const room = getIO().to(`channel:${message.channelId}`);
    room.emit("channel:message:delete", { messageId: params.messageId });
    room.emit("channel:pins:update");
  } catch {}

  return NextResponse.json({ ok: true });
}
