import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supporterTier } from "@/lib/supporters";

interface Params { params: { serverId: string } }

async function memberOf(serverId: string, userId: string) {
  return prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { id: true },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await memberOf(params.serverId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [count, mine] = await Promise.all([
    prisma.serverSupporter.count({ where: { serverId: params.serverId } }),
    prisma.serverSupporter.findUnique({
      where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ count, tier: supporterTier(count), supporting: Boolean(mine) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await memberOf(params.serverId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.serverSupporter.upsert({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    create: { serverId: params.serverId, userId: user.id },
    update: {},
  });

  const count = await prisma.serverSupporter.count({ where: { serverId: params.serverId } });
  return NextResponse.json({ count, tier: supporterTier(count), supporting: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.serverSupporter.deleteMany({ where: { serverId: params.serverId, userId: user.id } });
  const count = await prisma.serverSupporter.count({ where: { serverId: params.serverId } });
  return NextResponse.json({ count, tier: supporterTier(count), supporting: false });
}
