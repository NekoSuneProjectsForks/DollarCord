import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelPermissionsSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { channelId: string } }

async function requireManager(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { error: "Not found", status: 404 as const };
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId } },
    select: { role: true },
  });
  if (!member) return { error: "Forbidden", status: 403 as const };
  return { channel, isManager: ["OWNER", "ADMIN"].includes(member.role) };
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireManager(params.channelId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [overrides, roles] = await Promise.all([
    prisma.channelPermissionOverride.findMany({ where: { channelId: params.channelId } }),
    prisma.serverRole.findMany({
      where: { serverId: guard.channel.serverId },
      orderBy: [{ position: "asc" }],
      select: { id: true, name: true, color: true },
    }),
  ]);

  return NextResponse.json({ overrides, roles });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireManager(params.channelId, user.id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!guard.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = channelPermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Replace the channel's overrides atomically (drop ones that grant/deny nothing).
  const rows = parsed.data.overrides.filter((o) => o.allow !== 0 || o.deny !== 0);
  await prisma.$transaction([
    prisma.channelPermissionOverride.deleteMany({ where: { channelId: params.channelId } }),
    ...rows.map((o) =>
      prisma.channelPermissionOverride.create({
        data: {
          channelId: params.channelId,
          targetType: o.targetType,
          targetId: o.targetId,
          allow: o.allow,
          deny: o.deny,
        },
      })
    ),
  ]);

  try {
    // Visibility may have changed — nudge clients to refresh the channel list.
    getIO().to(`server:${guard.channel.serverId}`).emit("server:channels:refresh");
  } catch {}

  return NextResponse.json({ ok: true });
}
