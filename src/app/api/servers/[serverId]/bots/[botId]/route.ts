import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";

interface Params { params: { serverId: string; botId: string } }

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bot = await prisma.bot.findFirst({
    where: { id: params.botId, serverId: params.serverId },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  await prisma.bot.delete({ where: { id: params.botId } });
  return NextResponse.json({ ok: true });
}
