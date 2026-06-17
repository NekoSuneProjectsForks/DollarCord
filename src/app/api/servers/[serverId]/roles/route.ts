import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServerRoleSchema } from "@/lib/validations";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { getIO } from "@/server/socketServer";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.serverRole.findMany({
    where: { serverId: params.serverId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = createServerRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const lastRole = await prisma.serverRole.findFirst({
    where: { serverId: params.serverId },
    orderBy: { position: "desc" },
  });

  try {
    const role = await prisma.serverRole.create({
      data: {
        serverId: params.serverId,
        name: parsed.data.name,
        color: parsed.data.color,
        permissions: parsed.data.permissions ?? 0,
        position: (lastRole?.position ?? -1) + 1,
      },
    });

    try {
      getIO().to(`server:${params.serverId}`).emit("server:roles:update");
    } catch {}

    return NextResponse.json({ role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }
}
