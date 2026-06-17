import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeActivity } from "@/lib/presence";

// Bulk snapshot of statuses + activities for a set of users, used on initial
// load before live Socket.IO events take over. ?userIds=a,b,c (max 200).
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("userIds") ?? "";
  const userIds = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 200);
  if (userIds.length === 0) {
    return NextResponse.json({ statuses: {}, activities: {} });
  }

  const [users, activities] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, status: true, customStatus: true, customStatusEmoji: true },
    }),
    prisma.activity.findMany({
      where: { userId: { in: userIds }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const statuses: Record<string, { status: string; customStatus: string | null; customStatusEmoji: string | null }> = {};
  for (const u of users) {
    statuses[u.id] = { status: u.status, customStatus: u.customStatus, customStatusEmoji: u.customStatusEmoji };
  }

  const activityMap: Record<string, ReturnType<typeof serializeActivity>[]> = {};
  for (const a of activities) {
    (activityMap[a.userId] ??= []).push(serializeActivity(a));
  }

  return NextResponse.json({ statuses, activities: activityMap });
}
