import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserStartDmWithTarget } from "@/lib/serverSettings";
import { getIO } from "@/server/socketServer";

// List user's DM threads
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = await prisma.directMessageThread.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: true } },
      messages: {
        where: { deleted: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ threads });
}

// Create or get DM thread with another user
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUserId } = await req.json();
  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Block gating: neither party may DM if a block exists in either direction.
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: user.id },
      ],
    },
  });
  if (block) return NextResponse.json({ error: "You can't message this user" }, { status: 403 });

  // Check if thread already exists
  const existing = await prisma.directMessageThread.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
    include: { participants: { include: { user: true } } },
  });

  if (existing) {
    return NextResponse.json({ thread: existing });
  }

  const dmPrivacy = await canUserStartDmWithTarget(user.id, targetUserId);
  if (!dmPrivacy.allowed) {
    return NextResponse.json({ error: dmPrivacy.reason ?? "This user is not accepting DMs from shared servers" }, { status: 403 });
  }

  const thread = await prisma.directMessageThread.create({
    data: {
      participants: {
        create: [{ userId: user.id }, { userId: targetUserId }],
      },
    },
    include: { participants: { include: { user: true } } },
  });

  // Notify both users via socket
  try {
    const io = getIO();
    io.to(`user:${user.id}`).emit("dm:thread:create", { thread });
    io.to(`user:${targetUserId}`).emit("dm:thread:create", { thread });
  } catch {}

  return NextResponse.json({ thread }, { status: 201 });
}
