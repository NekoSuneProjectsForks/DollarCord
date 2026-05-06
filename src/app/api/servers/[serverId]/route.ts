import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateServerSchema } from "@/lib/validations";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const server = await prisma.server.findUnique({
    where: { id: params.serverId },
    include: {
      channels: { orderBy: { position: "asc" } },
      members: { include: { user: true, roles: { include: { role: true } } } },
      roles: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ server });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
    const parsed = updateServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const server = await prisma.server.update({
      where: { id: params.serverId },
      data: parsed.data,
    });
    return NextResponse.json({ server });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const server = await prisma.server.findUnique({ where: { id: params.serverId } });
  if (!server || server.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.server.delete({ where: { id: params.serverId } });
  return NextResponse.json({ ok: true });
}
