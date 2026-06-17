import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { normalizeChannelName } from "@/lib/discordTemplates";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

const templateSchema = z.object({
  dollarcordTemplate: z.number().optional(),
  categories: z.array(z.object({ name: z.string(), position: z.number().optional() })).optional(),
  channels: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional(),
        nsfw: z.boolean().optional(),
        category: z.string().nullable().optional(),
        threads: z.array(z.string()).optional(),
      })
    )
    .optional(),
  roles: z
    .array(z.object({ name: z.string(), color: z.string().optional(), permissions: z.number().optional() }))
    .optional(),
});

// Apply a native DollarCord template (from /export-template) to this server.
// Adds categories/channels/roles; skips names that already exist.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = templateSchema.safeParse(body?.template ?? body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template file" }, { status: 400 });
  }
  const tpl = parsed.data;

  const [existingChannels, existingCats, existingRoles] = await Promise.all([
    prisma.channel.findMany({ where: { serverId: params.serverId }, select: { name: true } }),
    prisma.channelCategory.findMany({ where: { serverId: params.serverId } }),
    prisma.serverRole.findMany({ where: { serverId: params.serverId }, select: { name: true } }),
  ]);

  const channelNames = new Set(existingChannels.map((c) => c.name));
  const roleNames = new Set(existingRoles.map((r) => r.name));
  const categoryByName = new Map(existingCats.map((c) => [c.name, c.id]));

  let createdCategories = 0;
  let categoryPos = existingCats.length;
  for (const cat of tpl.categories ?? []) {
    if (categoryByName.has(cat.name)) continue;
    const created = await prisma.channelCategory.create({
      data: { serverId: params.serverId, name: cat.name.slice(0, 100), position: categoryPos++ },
    });
    categoryByName.set(cat.name, created.id);
    createdCategories++;
  }

  let channelPos = existingChannels.length;
  let createdThreads = 0;
  const createdChannels = [];
  for (const ch of tpl.channels ?? []) {
    const name = normalizeChannelName(ch.name);
    if (!name || channelNames.has(name)) continue;
    channelNames.add(name);
    const created = await prisma.channel.create({
      data: {
        serverId: params.serverId,
        name,
        type: ch.type === "VOICE" ? "VOICE" : ch.type === "ANNOUNCEMENT" ? "ANNOUNCEMENT" : ch.type === "FORUM" ? "FORUM" : "TEXT",
        nsfw: ch.nsfw ?? false,
        categoryId: ch.category ? categoryByName.get(ch.category) ?? null : null,
        position: channelPos++,
      },
    });
    createdChannels.push(created);

    // Recreate threads under this channel (text-capable channels only).
    if (created.type !== "VOICE") {
      for (const threadName of (ch.threads ?? []).slice(0, 50)) {
        const tn = threadName.trim().slice(0, 100);
        if (!tn) continue;
        await prisma.thread.create({
          data: { channelId: created.id, name: tn, createdBy: user.id },
        });
        createdThreads++;
      }
    }
  }

  let rolePos = existingRoles.length;
  let createdRoles = 0;
  for (const role of (tpl.roles ?? []).slice(0, 25)) {
    const name = role.name.slice(0, 32);
    if (!name || name === "@everyone" || roleNames.has(name)) continue;
    roleNames.add(name);
    try {
      await prisma.serverRole.create({
        data: {
          serverId: params.serverId,
          name,
          color: /^#[0-9a-fA-F]{6}$/.test(role.color ?? "") ? role.color! : "#7c6af7",
          permissions: role.permissions ?? 0,
          position: rolePos++,
        },
      });
      createdRoles++;
    } catch {
      /* skip dupes */
    }
  }

  try {
    const io = getIO();
    for (const channel of createdChannels) {
      io.to(`server:${params.serverId}`).emit("server:channel:create", { channel });
    }
    io.to(`server:${params.serverId}`).emit("server:channels:refresh");
  } catch {}

  return NextResponse.json({
    createdCategories,
    createdChannels: createdChannels.length,
    createdRoles,
    createdThreads,
  });
}
