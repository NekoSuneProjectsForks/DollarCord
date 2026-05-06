import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@/lib/validations";
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

  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const search = req.nextUrl.searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {
    channelId: params.channelId,
    deleted: false,
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    ...(search ? { content: { contains: search } } : {}),
  };

  const messages = await prisma.message.findMany({
    where,
    include: {
      user: true,
      bot: true,
      reactions: { include: { user: true } },
      replyTo: { include: { user: true, bot: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const result = messages.slice(0, limit).reverse();

  return NextResponse.json({
    messages: result,
    hasMore,
    cursor: result.length > 0 ? result[0].createdAt : null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({ where: { id: params.channelId } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.replyToId) {
      const replyTo = await prisma.message.findFirst({
        where: {
          id: parsed.data.replyToId,
          channelId: params.channelId,
          deleted: false,
        },
      });

      if (!replyTo) {
        return NextResponse.json({ error: "Reply target not found" }, { status: 400 });
      }
    }

    const message = await prisma.message.create({
      data: {
        channelId: params.channelId,
        userId: user.id,
        content: parsed.data.content,
        replyToId: parsed.data.replyToId ?? null,
      },
      include: {
        user: true,
        bot: true,
        reactions: { include: { user: true } },
        replyTo: { include: { user: true, bot: true } },
      },
    });

    // Broadcast to everyone in the channel room
    try {
      getIO().to(`channel:${params.channelId}`).emit("channel:message", message);
    } catch {}

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[messages POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
