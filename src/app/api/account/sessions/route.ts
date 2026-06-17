import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COOKIE = "dollarcord_session";

// List the current user's active sessions (current one flagged).
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentToken = req.cookies.get(COOKIE)?.value;
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, createdAt: true, expiresAt: true },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      current: s.token === currentToken,
    })),
  });
}

// Revoke one session (?id=) or all others (no id).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentToken = req.cookies.get(COOKIE)?.value;
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    await prisma.session.deleteMany({ where: { id, userId: user.id } });
  } else {
    await prisma.session.deleteMany({
      where: { userId: user.id, ...(currentToken ? { token: { not: currentToken } } : {}) },
    });
  }

  return NextResponse.json({ ok: true });
}
