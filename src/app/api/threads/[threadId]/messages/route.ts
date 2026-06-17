import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@/lib/validations";
import { MESSAGE_INCLUDE, parseMentions } from "@/lib/messages";
import { getIO } from "@/server/socketServer";

interface Params { params: { threadId: string } }

async function requireThread(threadId: string, userId: string) {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { channel: { select: { serverId: true } } },
  });
  if (!thread) return { error: "Not found", status: 404 as const };
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: thread.channel.serverId, userId } },
  });
  if (!member) return { error: "Forbidden", status: 403 as const };
  return { thread, member };
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireThread(params.threadId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const messages = await prisma.message.findMany({
    where: { threadId: params.threadId, deleted: false },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireThread(params.threadId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { userIds, mentionsEveryone } = await parseMentions(parsed.data.content, guard.thread.channel.serverId);
  const attachments = parsed.data.attachments ?? [];

  const message = await prisma.message.create({
    data: {
      channelId: guard.thread.channelId,
      threadId: params.threadId,
      userId: user.id,
      content: parsed.data.content,
      mentionsEveryone,
      mentions: { create: userIds.map((id) => ({ userId: id })) },
      attachments: {
        create: attachments.map((a) => ({
          url: a.url, name: a.name, contentType: a.contentType, size: a.size,
          width: a.width ?? null, height: a.height ?? null,
        })),
      },
    },
    include: MESSAGE_INCLUDE,
  });

  await prisma.thread.update({ where: { id: params.threadId }, data: { lastMessageAt: new Date() } });

  try {
    getIO().to(`thread:${params.threadId}`).emit("thread:message", message);
  } catch {}

  return NextResponse.json({ message }, { status: 201 });
}
