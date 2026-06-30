import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setActivitySchema } from "@/lib/validations";
import { broadcastActivities, getUserActivities, recordActivityHistory } from "@/lib/presence";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const activities = await getUserActivities(user.id);
  return NextResponse.json({ activities });
}

// Set/replace the user's manual activity (source = "manual").
export async function PUT(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = setActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const d = parsed.data;
    await prisma.activity.upsert({
      where: { userId_source: { userId: user.id, source: "manual" } },
      create: {
        userId: user.id,
        source: "manual",
        type: d.type,
        name: d.name,
        details: d.details ?? null,
        state: d.state ?? null,
        url: d.url ?? null,
        largeImage: d.largeImage ?? null,
        smallImage: d.smallImage ?? null,
        startedAt: d.startedAt ? new Date(d.startedAt) : new Date(),
        joinUrl: d.joinUrl ?? null,
        partyCurrent: d.partyCurrent ?? null,
        partyMax: d.partyMax ?? null,
      },
      update: {
        type: d.type,
        name: d.name,
        details: d.details ?? null,
        state: d.state ?? null,
        url: d.url ?? null,
        largeImage: d.largeImage ?? null,
        smallImage: d.smallImage ?? null,
        joinUrl: d.joinUrl ?? null,
        partyCurrent: d.partyCurrent ?? null,
        partyMax: d.partyMax ?? null,
      },
    });

    await recordActivityHistory(user.id, { type: d.type, name: d.name, largeImage: d.largeImage ?? null, details: d.details ?? null });
    await broadcastActivities(user.id);
    const activities = await getUserActivities(user.id);
    return NextResponse.json({ activities });
  } catch (err) {
    console.error("[users/me/activity PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Clear the manual activity.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.activity.deleteMany({ where: { userId: user.id, source: "manual" } });
  await broadcastActivities(user.id);
  return NextResponse.json({ ok: true });
}
