import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { assignServerRolesSchema } from "@/lib/validations";
import { Permission, has } from "@/lib/permissionFlags";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string; userId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await getServerMember(params.serverId, user.id);
  if (!isServerManager(actor?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await getServerMember(params.serverId, params.userId);
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = assignServerRolesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const uniqueRoleIds = Array.from(new Set(parsed.data.roleIds));
  const roles = await prisma.serverRole.findMany({
    where: { id: { in: uniqueRoleIds }, serverId: params.serverId },
  });

  if (roles.length !== uniqueRoleIds.length) {
    return NextResponse.json({ error: "One or more roles were not found" }, { status: 400 });
  }

  // Hierarchy guard: only the owner may newly grant a server-managing role
  // (prevents a non-owner from escalating someone — including themselves).
  if (actor?.role !== "OWNER") {
    const adds = roles.some((r) => has(r.permissions, Permission.MANAGE_SERVER));
    if (adds) {
      const current = await prisma.serverMemberRole.findMany({
        where: { memberId: target.id },
        select: { role: { select: { permissions: true } } },
      });
      const alreadyHas = current.some((c) => has(c.role.permissions, Permission.MANAGE_SERVER));
      if (!alreadyHas) {
        return NextResponse.json(
          { error: "Only the server owner can grant a server-managing role" },
          { status: 403 }
        );
      }
    }
  }

  await prisma.$transaction([
    prisma.serverMemberRole.deleteMany({ where: { memberId: target.id } }),
    ...(roles.length
      ? [
          prisma.serverMemberRole.createMany({
            data: roles.map((role) => ({
              serverId: params.serverId,
              memberId: target.id,
              roleId: role.id,
            })),
          }),
        ]
      : []),
  ]);

  const member = await prisma.serverMember.findUnique({
    where: { id: target.id },
    include: { user: true, roles: { include: { role: true } } },
  });

  try {
    const io = getIO();
    io.to(`server:${params.serverId}`).emit("server:members:update");
    io.to(`user:${params.userId}`).emit("servers:update");
  } catch {}

  return NextResponse.json({ member });
}
