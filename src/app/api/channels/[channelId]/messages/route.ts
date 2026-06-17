import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@/lib/validations";
import { MESSAGE_INCLUDE, parseMentions } from "@/lib/messages";
import { getChannelPermissions, has, Permission } from "@/lib/permissions";
import { runAutomod } from "@/lib/automod";
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

  const viewPerms = await getChannelPermissions(params.channelId, channel.serverId, user.id);
  if (!has(viewPerms, Permission.VIEW_CHANNEL)) {
    return NextResponse.json({ error: "You can't view this channel" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const search = req.nextUrl.searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {
    channelId: params.channelId,
    deleted: false,
    threadId: null, // thread replies live in their own view
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    ...(search ? { content: { contains: search } } : {}),
  };

  const messages = await prisma.message.findMany({
    where,
    include: MESSAGE_INCLUDE,
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

    // Permission gate: must be able to view + send in this channel.
    const perms = await getChannelPermissions(params.channelId, channel.serverId, user.id);
    if (!has(perms, Permission.VIEW_CHANNEL)) {
      return NextResponse.json({ error: "You can't view this channel" }, { status: 403 });
    }
    if (!has(perms, Permission.SEND_MESSAGES)) {
      return NextResponse.json({ error: "You don't have permission to send messages here" }, { status: 403 });
    }

    // Slowmode: managers are exempt; everyone else must wait between messages.
    const isManager = ["OWNER", "ADMIN"].includes(member.role);
    if (channel.slowmodeSeconds > 0 && !isManager) {
      const last = await prisma.message.findFirst({
        where: { channelId: params.channelId, userId: user.id, deleted: false },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (last) {
        const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
        const remaining = Math.ceil(channel.slowmodeSeconds - elapsed);
        if (remaining > 0) {
          return NextResponse.json(
            { error: `Slowmode is on. Wait ${remaining}s before sending again.` },
            { status: 429 }
          );
        }
      }
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

    const { userIds: mentionedUserIds, mentionsEveryone } = await parseMentions(
      parsed.data.content,
      channel.serverId
    );

    // AutoMod (managers exempt).
    if (!isManager) {
      const verdict = await runAutomod(
        channel.serverId,
        parsed.data.content,
        mentionedUserIds.length + (mentionsEveryone ? 1 : 0)
      );
      if (verdict.blocked) {
        return NextResponse.json({ error: verdict.reason ?? "Message blocked by AutoMod" }, { status: 400 });
      }
    }

    // @everyone/@here only pings if the sender has MENTION_EVERYONE.
    const finalMentionsEveryone = mentionsEveryone && has(perms, Permission.MENTION_EVERYONE);
    const attachments = parsed.data.attachments ?? [];

    const message = await prisma.message.create({
      data: {
        channelId: params.channelId,
        userId: user.id,
        content: parsed.data.content,
        replyToId: parsed.data.replyToId ?? null,
        mentionsEveryone: finalMentionsEveryone,
        mentions: { create: mentionedUserIds.map((userId) => ({ userId })) },
        attachments: {
          create: attachments.map((a) => ({
            url: a.url,
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            width: a.width ?? null,
            height: a.height ?? null,
          })),
        },
      },
      include: MESSAGE_INCLUDE,
    });

    // Broadcast to everyone in the channel room + the server room (for sidebar
    // unread/mention badges in channels the user isn't currently viewing).
    try {
      const io = getIO();
      io.to(`channel:${params.channelId}`).emit("channel:message", message);
      io.to(`server:${channel.serverId}`).emit("channel:activity", {
        channelId: params.channelId,
        serverId: channel.serverId,
        mentionedUserIds,
        mentionsEveryone: finalMentionsEveryone,
        authorId: user.id,
      });
    } catch {}

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[messages POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
