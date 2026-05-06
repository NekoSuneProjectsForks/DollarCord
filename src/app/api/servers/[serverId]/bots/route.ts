import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { createBotToken, hashBotToken } from "@/lib/botTokens";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";
import { createBotSchema } from "@/lib/validations";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bots = await prisma.bot.findMany({
    where: { serverId: params.serverId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      serverId: true,
      name: true,
      username: true,
      avatarUrl: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ bots });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = createBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const token = createBotToken();
  try {
    const bot = await prisma.bot.create({
      data: {
        serverId: params.serverId,
        name: parsed.data.name,
        username: parsed.data.username,
        avatarUrl: parsed.data.avatarUrl ?? null,
        tokenHash: hashBotToken(token),
        createdBy: user.id,
      },
      select: {
        id: true,
        serverId: true,
        name: true,
        username: true,
        avatarUrl: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ bot, token }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A bot with that username already exists in this server" }, { status: 409 });
  }
}
