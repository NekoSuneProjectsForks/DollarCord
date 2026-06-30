import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { getRecentActivity } from "@/lib/presence";

interface Params { params: { userId: string } }

// Last-30-days game/app activity for a user (powers the profile "Recent activity" tab).
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recent = await getRecentActivity(params.userId);
  return NextResponse.json({ recent });
}
