import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { getUserLiveStatuses } from "@/lib/liveStreams";
import { prisma } from "@/lib/prisma";

interface Params { params: { userId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUserFromReq(req);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serverId = req.nextUrl.searchParams.get("serverId");
  if (serverId) {
    const viewerMember = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: currentUser.id } },
    });
    if (!viewerMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      twitchChannel: true,
      kickChannel: true,
      isPlatformAdmin: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const member = serverId
    ? await prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: params.userId } },
        include: { roles: { include: { role: true } } },
      })
    : null;

  if (serverId && !member) return NextResponse.json({ error: "User not found in server" }, { status: 404 });

  const streams = await getUserLiveStatuses(user);

  return NextResponse.json({ user, member, streams });
}
