import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createThreadSchema } from "@/lib/validations";
import { MESSAGE_INCLUDE, parseMentions } from "@/lib/messages";
import { getIO } from "@/server/socketServer";

interface Params { params: { channelId: string } }

async function requireMember(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { error: "Not found", status: 404 as const };
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId } },
  });
  if (!member) return { error: "Forbidden", status: 403 as const };
  return { channel, member };
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireMember(params.channelId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const threads = await prisma.thread.findMany({
    where: { channelId: params.channelId },
    orderBy: { lastMessageAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      readStates: { where: { userId: user.id }, select: { lastReadAt: true } },
    },
    take: 100,
  });

  const withUnread = threads.map(({ readStates, ...t }) => {
    const lastRead = readStates[0]?.lastReadAt;
    const unread = (t._count.messages ?? 0) > 0 && (!lastRead || t.lastMessageAt > lastRead);
    return { ...t, unread };
  });

  return NextResponse.json({ threads: withUnread });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireMember(params.channelId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json();
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const thread = await prisma.thread.create({
    data: {
      channelId: params.channelId,
      rootMessageId: parsed.data.rootMessageId ?? null,
      name: parsed.data.name,
      createdBy: user.id,
    },
    include: { _count: { select: { messages: true } } },
  });

  // Optional first message seeds the thread.
  if (parsed.data.content && parsed.data.content.trim()) {
    const { userIds, mentionsEveryone } = await parseMentions(parsed.data.content, guard.channel.serverId);
    const message = await prisma.message.create({
      data: {
        channelId: params.channelId,
        threadId: thread.id,
        userId: user.id,
        content: parsed.data.content,
        mentionsEveryone,
        mentions: { create: userIds.map((id) => ({ userId: id })) },
      },
      include: MESSAGE_INCLUDE,
    });
    await prisma.thread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
    try {
      getIO().to(`thread:${thread.id}`).emit("thread:message", message);
    } catch {}
  }

  try {
    getIO().to(`server:${guard.channel.serverId}`).emit("channel:thread:create", { channelId: params.channelId, thread });
  } catch {}

  return NextResponse.json({ thread }, { status: 201 });
}
