import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import {
  discordColorToHex,
  extractDiscordTemplateCode,
  fetchDiscordTemplate,
  normalizeChannelName,
} from "@/lib/discordTemplates";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { importDiscordTemplateSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

const TEXT_CHANNEL_TYPES = new Set([0, 5]); // text, announcement
const VOICE_CHANNEL_TYPES = new Set([2, 13]); // voice, stage

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

  const importVoice = parsed.data.importVoiceChannels ?? true;
  const importRoles = parsed.data.importRoles ?? true;

  const sourceChannels = template.serialized_source_guild.channels ?? [];
  const channelInputs = sourceChannels
    .filter((channel) =>
      TEXT_CHANNEL_TYPES.has(channel.type ?? -1) ||
      (importVoice && VOICE_CHANNEL_TYPES.has(channel.type ?? -1))
    )
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((channel) => ({
      name: normalizeChannelName(channel.name ?? ""),
      description: channel.topic?.slice(0, 256) ?? null,
      type: VOICE_CHANNEL_TYPES.has(channel.type ?? -1) ? "VOICE" : "TEXT",
    }))
    .filter((channel) => channel.name && !existingNames.has(channel.name))
    .slice(0, 100);

  const createdChannels = [];
  for (const channel of channelInputs) {
    existingNames.add(channel.name);
    const created = await prisma.channel.create({
      data: {
        serverId: params.serverId,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        position: nextPosition++,
      },
    });
    createdChannels.push(created);
  }

  // Roles (skip @everyone and any names that already exist).
  const createdRoles = [];
  if (importRoles) {
    const existingRoles = await prisma.serverRole.findMany({
      where: { serverId: params.serverId },
      select: { name: true, position: true },
    });
    const existingRoleNames = new Set(existingRoles.map((r) => r.name));
    let rolePos = existingRoles.length;

    const sourceRoles = (template.serialized_source_guild.roles ?? [])
      .filter((r) => r.name && r.name !== "@everyone" && !existingRoleNames.has(r.name.slice(0, 32)))
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
      .slice(0, 25);

    for (const role of sourceRoles) {
      const name = role.name!.slice(0, 32);
      existingRoleNames.add(name);
      try {
        const created = await prisma.serverRole.create({
          data: {
            serverId: params.serverId,
            name,
            color: discordColorToHex(role.color),
            position: rolePos++,
          },
        });
        createdRoles.push(created);
      } catch {
        // Unique-constraint race or invalid name — skip this role.
      }
    }
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

  if (createdChannels.length === 0 && createdRoles.length === 0 && !parsed.data.importServerName) {
    return NextResponse.json({ error: "Nothing new to import from that template" }, { status: 400 });
  }

  try {
    const io = getIO();
    for (const channel of createdChannels) {
      io.to(`server:${params.serverId}`).emit("server:channel:create", { channel });
    }
  } catch {}

  return NextResponse.json(
    { templateName: template.name, channels: createdChannels, roles: createdRoles },
    { status: 201 }
  );
}
