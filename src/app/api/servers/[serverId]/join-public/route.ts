import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlan, withinLimit } from "@/lib/plans";

interface Params { params: { serverId: string } }

// Join a public (discoverable) server without an invite code.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const server = await prisma.server.findUnique({
    where: { id: params.serverId },
    select: { id: true, isPublic: true, plan: true },
  });
  if (!server || !server.isPublic) {
    return NextResponse.json({ error: "Server is not public" }, { status: 404 });
  }

  const banned = await prisma.serverBan.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (banned) return NextResponse.json({ error: "You are banned from this server" }, { status: 403 });

  const plan = resolvePlan(server.plan);
  const memberCount = await prisma.serverMember.count({ where: { serverId: params.serverId } });
  const alreadyMember = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!alreadyMember && !withinLimit(memberCount, plan.maxMembers)) {
    return NextResponse.json({ error: "This server is full (member limit reached)." }, { status: 403 });
  }

  await prisma.serverMember.upsert({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    create: { serverId: params.serverId, userId: user.id, role: "MEMBER" },
    update: {},
  });

  return NextResponse.json({ ok: true, serverId: params.serverId });
}
