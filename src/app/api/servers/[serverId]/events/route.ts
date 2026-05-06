import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { serializeEventForUser } from "@/lib/serverEvents";
import { createServerEventSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

function eventInclude(userId: string) {
  return {
    channel: true,
    creator: {
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        twitchChannel: true,
        kickChannel: true,
        createdAt: true,
      },
    },
    participants: { where: { userId } },
    _count: { select: { participants: true } },
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const includePast = req.nextUrl.searchParams.get("includePast") === "true";
  const events = await prisma.serverEvent.findMany({
    where: {
      serverId: params.serverId,
      canceled: false,
      ...(includePast ? {} : { startsAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }),
    },
    include: eventInclude(user.id),
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  return NextResponse.json({ events: events.map((event) => serializeEventForUser(event, user.id)) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = createServerEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  if (parsed.data.channelId) {
    const channel = await prisma.channel.findFirst({
      where: { id: parsed.data.channelId, serverId: params.serverId },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 400 });
  }

  const event = await prisma.serverEvent.create({
    data: {
      serverId: params.serverId,
      channelId: parsed.data.channelId ?? null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      startsAt,
      endsAt,
      createdBy: user.id,
      participants: {
        create: { userId: user.id, notify: true },
      },
    },
    include: eventInclude(user.id),
  });

  const serialized = serializeEventForUser(event, user.id);

  try {
    getIO().to(`server:${params.serverId}`).emit("server:event:create", { event: serialized });
  } catch {}

  return NextResponse.json({ event: serialized }, { status: 201 });
}
