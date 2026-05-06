import { NextRequest, NextResponse } from "next/server";
import { hashBotToken, readBotToken } from "@/lib/botTokens";
import { prisma } from "@/lib/prisma";
import { sendBotMessageSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

export async function POST(req: NextRequest) {
  const token = readBotToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Bot token required" }, { status: 401 });

  const bot = await prisma.bot.findUnique({
    where: { tokenHash: hashBotToken(token) },
  });
  if (!bot) return NextResponse.json({ error: "Invalid bot token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = sendBotMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: parsed.data.channelId },
  });
  if (!channel || channel.serverId !== bot.serverId) {
    return NextResponse.json({ error: "Channel not found for this bot" }, { status: 404 });
  }

  const message = await prisma.message.create({
    data: {
      channelId: parsed.data.channelId,
      botId: bot.id,
      content: parsed.data.content,
    },
    include: {
      user: true,
      bot: true,
      reactions: { include: { user: true } },
      replyTo: { include: { user: true, bot: true } },
    },
  });

  try {
    getIO().to(`channel:${parsed.data.channelId}`).emit("channel:message", message);
  } catch {}

  return NextResponse.json({ message }, { status: 201 });
}
