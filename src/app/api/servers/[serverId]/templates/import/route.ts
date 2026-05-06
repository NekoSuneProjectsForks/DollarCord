import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { extractDiscordTemplateCode, fetchDiscordTemplate, normalizeChannelName } from "@/lib/discordTemplates";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { importDiscordTemplateSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

const TEXT_CHANNEL_TYPES = new Set([0, 5]);

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = importDiscordTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const code = extractDiscordTemplateCode(parsed.data.template);
  if (!code) return NextResponse.json({ error: "Invalid Discord template link or code" }, { status: 400 });

  const template = await fetchDiscordTemplate(code);
  if (!template?.serialized_source_guild) {
    return NextResponse.json({ error: "Discord template not found or not public" }, { status: 404 });
  }

  const existingChannels = await prisma.channel.findMany({
    where: { serverId: params.serverId },
    select: { name: true },
  });
  const existingNames = new Set(existingChannels.map((channel) => channel.name));
  let nextPosition = existingChannels.length;

  const sourceChannels = template.serialized_source_guild.channels ?? [];
  const channelInputs = sourceChannels
    .filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type ?? -1))
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((channel) => ({
      name: normalizeChannelName(channel.name ?? ""),
      description: channel.topic?.slice(0, 256) ?? null,
    }))
    .filter((channel) => channel.name && !existingNames.has(channel.name))
    .slice(0, 50);

  if (channelInputs.length === 0) {
    return NextResponse.json({ error: "No new text channels found in that template" }, { status: 400 });
  }

  const createdChannels = [];
  for (const channel of channelInputs) {
    existingNames.add(channel.name);
    const created = await prisma.channel.create({
      data: {
        serverId: params.serverId,
        name: channel.name,
        description: channel.description,
        position: nextPosition++,
      },
    });
    createdChannels.push(created);
  }

  if (parsed.data.importServerName && template.serialized_source_guild.name) {
    await prisma.server.update({
      where: { id: params.serverId },
      data: {
        name: template.serialized_source_guild.name.slice(0, 100),
        description: template.serialized_source_guild.description?.slice(0, 500) ?? undefined,
      },
    });
  }

  try {
    const io = getIO();
    for (const channel of createdChannels) {
      io.to(`server:${params.serverId}`).emit("server:channel:create", { channel });
    }
  } catch {}

  return NextResponse.json({ templateName: template.name, channels: createdChannels }, { status: 201 });
}
