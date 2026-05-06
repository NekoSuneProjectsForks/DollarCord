import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { updateServerRoleSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string; roleId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateServerRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const existing = await prisma.serverRole.findFirst({
    where: { id: params.roleId, serverId: params.serverId },
  });
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  try {
    const role = await prisma.serverRole.update({
      where: { id: params.roleId },
      data: parsed.data,
    });

    try {
      const io = getIO();
      io.to(`server:${params.serverId}`).emit("server:roles:update");
      io.to(`server:${params.serverId}`).emit("server:members:update");
    } catch {}

    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.serverRole.findFirst({
    where: { id: params.roleId, serverId: params.serverId },
  });
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  await prisma.serverRole.delete({ where: { id: params.roleId } });

  try {
    const io = getIO();
    io.to(`server:${params.serverId}`).emit("server:roles:update");
    io.to(`server:${params.serverId}`).emit("server:members:update");
  } catch {}

  return NextResponse.json({ ok: true });
}
