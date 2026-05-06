import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canChangeRole, canRemoveMember } from "@/lib/serverPermissions";
import { getIO } from "@/server/socketServer";
import type { MemberRole } from "@/types";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.serverMember.findMany({
    where: { serverId: params.serverId },
    include: { user: true, roles: { include: { role: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  return NextResponse.json({ members });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!actor || !["OWNER", "ADMIN"].includes(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Use leave server to remove yourself" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { role, kick } = body as { role?: string; kick?: boolean };

  const target = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: targetUserId } },
  });
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const actorRole = actor.role as MemberRole;
  const targetRole = target.role as MemberRole;

  if (kick) {
    if (!canRemoveMember(actorRole, targetRole)) {
      return NextResponse.json({ error: "You cannot remove that member" }, { status: 403 });
    }

    await prisma.serverMember.delete({
      where: { serverId_userId: { serverId: params.serverId, userId: targetUserId } },
    });

    try {
      const io = getIO();
      io.to(`server:${params.serverId}`).emit("server:members:update");
      io.to(`user:${targetUserId}`).emit("servers:update");
    } catch {}

    return NextResponse.json({ ok: true });
  }

  if (role && ["ADMIN", "MEMBER"].includes(role)) {
    if (!canChangeRole(actorRole, targetRole)) {
      return NextResponse.json({ error: "You cannot change that member's role" }, { status: 403 });
    }

    await prisma.serverMember.update({
      where: { serverId_userId: { serverId: params.serverId, userId: targetUserId } },
      data: { role },
    });

    try {
      const io = getIO();
      io.to(`server:${params.serverId}`).emit("server:members:update");
      io.to(`user:${targetUserId}`).emit("servers:update");
    } catch {}

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No action specified" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const server = await prisma.server.findUnique({ where: { id: params.serverId } });
  if (server?.ownerId === user.id) {
    return NextResponse.json({ error: "Owner cannot leave - transfer ownership or delete server" }, { status: 400 });
  }

  await prisma.serverMember.delete({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });

  try {
    const io = getIO();
    io.to(`server:${params.serverId}`).emit("server:members:update");
    io.to(`user:${user.id}`).emit("servers:update");
  } catch {}

  return NextResponse.json({ ok: true });
}
