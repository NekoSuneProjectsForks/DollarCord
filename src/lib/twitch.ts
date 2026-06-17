import type { LiveStreamStatus } from "@/types";

// Minimal Twitch Helix client. Uses an app access token (client-credentials
// grant) cached in module scope. Requires TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET.

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export function twitchConfigured(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

async function getAppToken(): Promise<string | null> {
  if (!twitchConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    client_secret: process.env.TWITCH_CLIENT_SECRET!,
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
    method: "POST",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

function thumbUrl(template: string | null | undefined): string | null {
  if (!template) return null;
  return template.replace("{width}", "440").replace("{height}", "248");
}

/**
 * Look up live status for a Twitch login name. Returns null when Twitch isn't
 * configured (callers should treat that as "unknown / not live").
 */
export async function getTwitchLiveStatus(channel: string): Promise<LiveStreamStatus | null> {
  const token = await getAppToken();
  if (!token) return null;

  const login = channel.trim().toLowerCase();
  const headers = {
    "Client-ID": process.env.TWITCH_CLIENT_ID!,
    Authorization: `Bearer ${token}`,
  };

  const streamRes = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
    { headers, next: { revalidate: 30 } }
  );
  if (!streamRes.ok) return null;

  const stream = (await streamRes.json()) as {
    data: Array<{
      title: string;
      game_name: string;
      viewer_count: number;
      started_at: string;
      thumbnail_url: string;
    }>;
  };

  const live = stream.data[0];
  const url = `https://twitch.tv/${login}`;

  if (!live) {
    return {
      provider: "twitch",
      channel: login,
      url,
      isLive: false,
      title: null,
      category: null,
      thumbnailUrl: null,
      viewerCount: null,
      startedAt: null,
    };
  }

  return {
    provider: "twitch",
    channel: login,
    url,
    isLive: true,
    title: live.title || null,
    category: live.game_name || null,
    thumbnailUrl: thumbUrl(live.thumbnail_url),
    viewerCount: live.viewer_count ?? null,
    startedAt: live.started_at || null,
  };
}
