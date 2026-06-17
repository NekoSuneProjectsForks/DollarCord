import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Export all of the current user's data as a downloadable JSON (GDPR-style).
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, messages, dms, memberships, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, username: true, displayName: true, bio: true, avatarUrl: true,
        twitchChannel: true, kickChannel: true, status: true, customStatus: true, createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: { userId: user.id },
      select: { id: true, channelId: true, content: true, createdAt: true, edited: true, deleted: true },
    }),
    prisma.directMessage.findMany({
      where: { senderId: user.id },
      select: { id: true, threadId: true, content: true, createdAt: true },
    }),
    prisma.serverMember.findMany({
      where: { userId: user.id },
      select: { serverId: true, role: true, joinedAt: true, server: { select: { name: true } } },
    }),
    prisma.activity.findMany({ where: { userId: user.id } }),
  ]);

  const payload = { exportedAt: new Date().toISOString(), profile, messages, directMessages: dms, memberships, activities };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dollarcord-export-${user.username}.json"`,
    },
  });
}

// Permanently delete the account. Requires the current password. Owned servers
// (and all their data) are deleted first to satisfy foreign keys.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!compareSync(password, dbUser.passwordHash)) {
    return NextResponse.json({ error: "Password is incorrect" }, { status: 401 });
  }

  await prisma.server.deleteMany({ where: { ownerId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dollarcord_session", "", { httpOnly: true, path: "/", expires: new Date(0) });
  return res;
}
