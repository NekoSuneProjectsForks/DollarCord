import type { LiveStreamStatus } from "@/types";

// Best-effort Kick live detection via their public channel endpoint. Kick has
// no official OAuth streams API like Twitch, so we read the public v2 channel
// JSON. This can be rate-limited or Cloudflare-gated; failures return null and
// callers treat that as "unknown".

interface KickChannelResponse {
  slug?: string;
  user?: { username?: string };
  livestream?: {
    is_live?: boolean;
    session_title?: string;
    viewer_count?: number;
    created_at?: string;
    thumbnail?: { url?: string } | null;
    categories?: Array<{ name?: string }>;
  } | null;
}

export async function getKickLiveStatus(channel: string): Promise<LiveStreamStatus | null> {
  const slug = channel.trim().toLowerCase();
  const url = `https://kick.com/${slug}`;
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as KickChannelResponse;
    const live = data.livestream;

    if (!live || !live.is_live) {
      return {
        provider: "kick",
        channel: slug,
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
      provider: "kick",
      channel: slug,
      url,
      isLive: true,
      title: live.session_title || null,
      category: live.categories?.[0]?.name || null,
      thumbnailUrl: live.thumbnail?.url || null,
      viewerCount: live.viewer_count ?? null,
      startedAt: live.created_at || null,
    };
  } catch {
    return null;
  }
}
