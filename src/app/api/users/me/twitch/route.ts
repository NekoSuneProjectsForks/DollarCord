import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { syncUserStreams } from "@/lib/streams";
import { twitchConfigured } from "@/lib/twitch";

// Manually refresh the current user's stream presence (Twitch + Kick). Syncs the
// "streaming" activities, fires "now live" announcements on transition, and
// returns the live status for each linked provider.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.twitchChannel && !user.kickChannel) {
    return NextResponse.json({ configured: twitchConfigured(), twitch: null, kick: null });
  }

  const { twitch, kick } = await syncUserStreams(user.id, {
    twitchChannel: user.twitchChannel,
    kickChannel: user.kickChannel,
  });

  return NextResponse.json({ configured: twitchConfigured(), twitch, kick });
}
