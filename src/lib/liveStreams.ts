import type { LiveStreamStatus } from "@/types";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let twitchTokenCache: TokenCache | null = null;
let kickTokenCache: TokenCache | null = null;

function cleanChannel(value: string) {
  return value.trim().replace(/^@/, "");
}

function offline(provider: LiveStreamStatus["provider"], channel: string): LiveStreamStatus {
  return {
    provider,
    channel,
    url: provider === "twitch" ? `https://www.twitch.tv/${channel}` : `https://kick.com/${channel}`,
    isLive: false,
    title: null,
    category: null,
    thumbnailUrl: null,
    viewerCount: null,
    startedAt: null,
  };
}

async function getTwitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (twitchTokenCache && twitchTokenCache.expiresAt > Date.now() + 60_000) {
    return twitchTokenCache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  twitchTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function getKickAppToken() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (kickTokenCache && kickTokenCache.expiresAt > Date.now() + 60_000) {
    return kickTokenCache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  kickTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export async function getTwitchLiveStatus(rawChannel: string): Promise<LiveStreamStatus> {
  const channel = cleanChannel(rawChannel);
  const base = offline("twitch", channel);
  if (!channel) return base;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAppToken().catch(() => null);
  if (!clientId || !token) return base;

  const params = new URLSearchParams({ user_login: channel });
  const res = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return base;

  const data = (await res.json()) as {
    data?: Array<{
      user_login?: string;
      user_name?: string;
      game_name?: string;
      title?: string;
      viewer_count?: number;
      started_at?: string;
      thumbnail_url?: string;
    }>;
  };
  const stream = data.data?.[0];
  if (!stream) return base;

  return {
    ...base,
    channel: stream.user_login ?? channel,
    url: `https://www.twitch.tv/${stream.user_login ?? channel}`,
    isLive: true,
    title: stream.title ?? null,
    category: stream.game_name ?? null,
    thumbnailUrl: stream.thumbnail_url?.replace("{width}", "440").replace("{height}", "248") ?? null,
    viewerCount: stream.viewer_count ?? null,
    startedAt: stream.started_at ?? null,
  };
}

export async function getKickLiveStatus(rawChannel: string): Promise<LiveStreamStatus> {
  const channel = cleanChannel(rawChannel);
  const base = offline("kick", channel);
  if (!channel) return base;

  const token = await getKickAppToken().catch(() => null);
  if (!token) return base;

  const params = new URLSearchParams();
  params.append("slug", channel);

  const res = await fetch(`https://api.kick.com/public/v1/channels?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return base;

  const data = (await res.json()) as {
    data?: Array<{
      slug?: string;
      stream_title?: string;
      category?: { name?: string };
      stream?: {
        is_live?: boolean;
        thumbnail?: string;
        viewer_count?: number;
        start_time?: string;
      };
      livestream?: {
        is_live?: boolean;
        session_title?: string;
        thumbnail?: string;
        viewers?: number;
        created_at?: string;
        categories?: Array<{ name?: string }>;
      };
    }>;
  };
  const channelData = data.data?.[0];
  if (!channelData) return base;

  const stream = channelData.stream;
  const livestream = channelData.livestream;
  const isLive = Boolean(stream?.is_live ?? livestream?.is_live);
  if (!isLive) {
    return { ...base, channel: channelData.slug ?? channel, url: `https://kick.com/${channelData.slug ?? channel}` };
  }

  return {
    ...base,
    channel: channelData.slug ?? channel,
    url: `https://kick.com/${channelData.slug ?? channel}`,
    isLive,
    title: channelData.stream_title ?? livestream?.session_title ?? null,
    category: channelData.category?.name ?? livestream?.categories?.[0]?.name ?? null,
    thumbnailUrl: stream?.thumbnail ?? livestream?.thumbnail ?? null,
    viewerCount: stream?.viewer_count ?? livestream?.viewers ?? null,
    startedAt: stream?.start_time ?? livestream?.created_at ?? null,
  };
}

export async function getUserLiveStatuses(user: {
  twitchChannel?: string | null;
  kickChannel?: string | null;
}) {
  const checks: Promise<LiveStreamStatus>[] = [];
  if (user.twitchChannel) checks.push(getTwitchLiveStatus(user.twitchChannel));
  if (user.kickChannel) checks.push(getKickLiveStatus(user.kickChannel));
  return Promise.all(checks);
}
