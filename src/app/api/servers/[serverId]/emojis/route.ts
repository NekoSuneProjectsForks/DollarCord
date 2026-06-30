import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEmojiSchema } from "@/lib/validations";
import { resolvePlan, withinLimit } from "@/lib/plans";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const emojis = await prisma.serverEmoji.findMany({ where: { serverId: params.serverId }, orderBy: { name: "asc" } });
  return NextResponse.json({ emojis });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { role: true },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createEmojiSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const server = await prisma.server.findUnique({ where: { id: params.serverId }, select: { plan: true } });
  const plan = resolvePlan(server?.plan);
  const count = await prisma.serverEmoji.count({ where: { serverId: params.serverId } });
  if (!withinLimit(count, plan.customEmojis)) {
    return NextResponse.json({ error: `Your plan allows ${plan.customEmojis} custom emojis.` }, { status: 403 });
  }

  try {
    const emoji = await prisma.serverEmoji.create({
      data: { serverId: params.serverId, name: parsed.data.name, url: parsed.data.url, createdBy: user.id },
    });
    return NextResponse.json({ emoji }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An emoji with that name already exists" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { role: true },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (id) await prisma.serverEmoji.deleteMany({ where: { id, serverId: params.serverId } });
  return NextResponse.json({ ok: true });
}
