import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitchLiveStatus, twitchConfigured } from "@/lib/twitch";
import { broadcastActivities } from "@/lib/presence";

// Checks the current user's linked Twitch channel and syncs a "streaming"
// activity (source = "twitch") accordingly. Returns the live status.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.twitchChannel) {
    return NextResponse.json({ configured: twitchConfigured(), status: null });
  }

  const status = await getTwitchLiveStatus(user.twitchChannel);

  // Twitch not configured / unreachable — don't touch presence.
  if (status === null) {
    return NextResponse.json({ configured: false, status: null });
  }

  if (status.isLive) {
    await prisma.activity.upsert({
      where: { userId_source: { userId: user.id, source: "twitch" } },
      create: {
        userId: user.id,
        source: "twitch",
        type: "STREAMING",
        name: status.title || `Live on Twitch`,
        details: status.category,
        state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
        url: status.url,
        largeImage: status.thumbnailUrl,
        startedAt: status.startedAt ? new Date(status.startedAt) : new Date(),
        // Refreshed each poll; expires so a missed poll eventually clears it.
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      update: {
        name: status.title || `Live on Twitch`,
        details: status.category,
        state: status.viewerCount != null ? `${status.viewerCount} viewers` : null,
        url: status.url,
        largeImage: status.thumbnailUrl,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await broadcastActivities(user.id);
  } else {
    const existing = await prisma.activity.findUnique({
      where: { userId_source: { userId: user.id, source: "twitch" } },
    });
    if (existing) {
      await prisma.activity.delete({ where: { id: existing.id } });
      await broadcastActivities(user.id);
    }
  }

  return NextResponse.json({ configured: true, status });
}
