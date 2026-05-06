import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string; eventId: string } }

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await prisma.serverEvent.findFirst({
    where: { id: params.eventId, serverId: params.serverId },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.serverEvent.update({
    where: { id: params.eventId },
    data: { canceled: true },
  });

  try {
    getIO().to(`server:${params.serverId}`).emit("server:event:delete", { eventId: params.eventId });
  } catch {}

  return NextResponse.json({ ok: true });
}
