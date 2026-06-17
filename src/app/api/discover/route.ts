import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Public server directory. Lists servers flagged isPublic with member/supporter
// counts and whether the current user already belongs.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();

  const servers = await prisma.server.findMany({
    where: {
      isPublic: true,
      ...(q ? { name: { contains: q } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
      _count: { select: { members: true, supporters: true } },
      members: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { members: { _count: "desc" } },
    take: 60,
  });

  return NextResponse.json({
    servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      iconUrl: s.iconUrl,
      memberCount: s._count.members,
      supporterCount: s._count.supporters,
      joined: s.members.length > 0,
    })),
  });
}
