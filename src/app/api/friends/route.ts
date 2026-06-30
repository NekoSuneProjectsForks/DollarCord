import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { friendRequestSchema } from "@/lib/validations";
import { getIO } from "@/server/socketServer";

const USER_SELECT = { id: true, username: true, displayName: true, avatarUrl: true };

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rels, blocks] = await Promise.all([
    prisma.friendship.findMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: { requester: { select: USER_SELECT }, addressee: { select: USER_SELECT } },
    }),
    prisma.block.findMany({ where: { blockerId: user.id }, include: { blocked: { select: USER_SELECT } } }),
  ]);

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of rels) {
    const other = r.requesterId === user.id ? r.addressee : r.requester;
    if (r.status === "ACCEPTED") friends.push({ id: r.id, user: other });
    else if (r.requesterId === user.id) outgoing.push({ id: r.id, user: other });
    else incoming.push({ id: r.id, user: other });
  }

  return NextResponse.json({
    friends,
    incoming,
    outgoing,
    blocked: blocks.map((b) => ({ id: b.id, user: b.blocked })),
  });
}

// Send a friend request by username (auto-accepts if the reverse request exists).
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = friendRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const target = await prisma.user.findFirst({
    where: { username: { equals: parsed.data.username } },
    select: { id: true, username: true },
  });
  // SQLite is case-sensitive; fall back to a case-insensitive scan.
  const targetUser = target
    ? target
    : (await prisma.user.findMany({ select: { id: true, username: true } })).find(
        (u) => u.username.toLowerCase() === parsed.data.username.toLowerCase()
      );
  if (!targetUser) return NextResponse.json({ error: "No user with that username" }, { status: 404 });
  if (targetUser.id === user.id) return NextResponse.json({ error: "You can't friend yourself" }, { status: 400 });

  const blocked = await prisma.block.findFirst({
    where: { OR: [{ blockerId: user.id, blockedId: targetUser.id }, { blockerId: targetUser.id, blockedId: user.id }] },
  });
  if (blocked) return NextResponse.json({ error: "Can't send a request to this user" }, { status: 403 });

  // Reverse pending request → accept it.
  const reverse = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: targetUser.id, addresseeId: user.id } },
  });
  if (reverse) {
    await prisma.friendship.update({ where: { id: reverse.id }, data: { status: "ACCEPTED" } });
  } else {
    await prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: user.id, addresseeId: targetUser.id } },
      create: { requesterId: user.id, addresseeId: targetUser.id, status: "PENDING" },
      update: {},
    });
  }
  try { getIO().to(`user:${targetUser.id}`).emit("friends:update"); } catch {}
  return NextResponse.json({ ok: true });
}

// Accept / remove / block / unblock.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { userId, action } = body as { userId?: string; action?: string };
  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  if (action === "accept") {
    await prisma.friendship.updateMany({
      where: { requesterId: userId, addresseeId: user.id, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
  } else if (action === "remove") {
    await prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: user.id, addresseeId: userId }, { requesterId: userId, addresseeId: user.id }] },
    });
  } else if (action === "block") {
    await prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: user.id, addresseeId: userId }, { requesterId: userId, addresseeId: user.id }] },
    });
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      create: { blockerId: user.id, blockedId: userId },
      update: {},
    });
  } else if (action === "unblock") {
    await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try { getIO().to(`user:${userId}`).emit("friends:update"); } catch {}
  return NextResponse.json({ ok: true });
}
