import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The RPC token lets a local game/app (or the future desktop agent) push Rich
// Presence to /api/rpc/activity without a session cookie. It is shown to the
// user once and can be regenerated to revoke old clients.

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rpcToken: true },
  });
  return NextResponse.json({ token: row?.rpcToken ?? null });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = `dcrpc_${randomBytes(24).toString("hex")}`;
  await prisma.user.update({ where: { id: user.id }, data: { rpcToken: token } });
  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { rpcToken: null } });
  // Also clear any presence the RPC client had set.
  await prisma.activity.deleteMany({ where: { userId: user.id, source: "rpc" } });
  return NextResponse.json({ ok: true });
}
