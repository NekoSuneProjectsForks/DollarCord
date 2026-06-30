import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPollSchema } from "@/lib/validations";
import { MESSAGE_INCLUDE } from "@/lib/messages";
import { getChannelPermissions, has, Permission } from "@/lib/permissions";
import { getIO } from "@/server/socketServer";

interface Params { params: { channelId: string } }

// Create a poll as a message in a channel.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = await prisma.channel.findUnique({ where: { id: params.channelId }, select: { serverId: true } });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const perms = await getChannelPermissions(params.channelId, channel.serverId, user.id);
  if (!has(perms, Permission.SEND_MESSAGES)) {
    return NextResponse.json({ error: "You can't post here" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createPollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      channelId: params.channelId,
      userId: user.id,
      content: `📊 ${parsed.data.question}`,
      poll: {
        create: {
          question: parsed.data.question,
          multiple: parsed.data.multiple ?? false,
          options: { create: parsed.data.options.map((text, i) => ({ text, position: i })) },
        },
      },
    },
    include: MESSAGE_INCLUDE,
  });

  try { getIO().to(`channel:${params.channelId}`).emit("channel:message", message); } catch {}
  return NextResponse.json({ message }, { status: 201 });
}
