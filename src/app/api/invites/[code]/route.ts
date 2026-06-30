import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: { code: string } }

// Preview an invite (for the in-chat invite card + the /invite page).
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);

  const invite = await prisma.invite.findUnique({
    where: { code: params.code },
    include: { server: { include: { _count: { select: { members: true } } } } },
  });
  if (!invite) return NextResponse.json({ valid: false }, { status: 404 });

  const expired =
    (invite.expiresAt && invite.expiresAt < new Date()) ||
    (invite.maxUses != null && invite.uses >= invite.maxUses);

  const joined = user
    ? Boolean(
        await prisma.serverMember.findUnique({
          where: { serverId_userId: { serverId: invite.serverId, userId: user.id } },
          select: { id: true },
        })
      )
    : false;

  return NextResponse.json({
    valid: !expired,
    expired: Boolean(expired),
    joined,
    code: invite.code,
    server: {
      id: invite.server.id,
      name: invite.server.name,
      iconUrl: invite.server.iconUrl,
      memberCount: invite.server._count.members,
    },
  });
}
