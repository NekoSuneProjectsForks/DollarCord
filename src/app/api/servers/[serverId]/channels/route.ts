import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChannelSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const channels = await prisma.channel.findMany({
    where: { serverId: params.serverId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ channels });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const count = await prisma.channel.count({ where: { serverId: params.serverId } });
    const channel = await prisma.channel.create({
      data: {
        serverId: params.serverId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        type: parsed.data.type ?? "TEXT",
        position: count,
      },
    });

    // Broadcast to server room
    try {
      getIO().to(`server:${params.serverId}`).emit("server:channel:create", { channel });
    } catch {}

    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    console.error("[channels POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
