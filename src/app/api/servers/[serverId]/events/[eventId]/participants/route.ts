import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember } from "@/lib/serverApi";
import { updateServerEventParticipantSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string; eventId: string } }

async function verifyEvent(serverId: string, eventId: string) {
  return prisma.serverEvent.findFirst({
    where: { id: eventId, serverId, canceled: false },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await verifyEvent(params.serverId, params.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const participant = await prisma.serverEventParticipant.upsert({
    where: { eventId_userId: { eventId: params.eventId, userId: user.id } },
    update: { notify: true },
    create: { eventId: params.eventId, userId: user.id, notify: true },
  });

  const participantCount = await prisma.serverEventParticipant.count({ where: { eventId: params.eventId } });

  try {
    getIO().to(`server:${params.serverId}`).emit("server:event:update", {
      eventId: params.eventId,
      participantCount,
    });
  } catch {}

  return NextResponse.json({ participant, participantCount });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await verifyEvent(params.serverId, params.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateServerEventParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const participant = await prisma.serverEventParticipant.update({
    where: { eventId_userId: { eventId: params.eventId, userId: user.id } },
    data: { notify: parsed.data.notify },
  });

  return NextResponse.json({ participant });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await verifyEvent(params.serverId, params.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.serverEventParticipant.deleteMany({
    where: { eventId: params.eventId, userId: user.id },
  });
  const participantCount = await prisma.serverEventParticipant.count({ where: { eventId: params.eventId } });

  try {
    getIO().to(`server:${params.serverId}`).emit("server:event:update", {
      eventId: params.eventId,
      participantCount,
    });
  } catch {}

  return NextResponse.json({ ok: true, participantCount });
}
