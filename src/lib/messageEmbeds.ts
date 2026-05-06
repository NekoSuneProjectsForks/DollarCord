export interface MessageEmbed {
  type: "link" | "image" | "twitch" | "kick";
  url: string;
  providerName: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  actionLabel: string;
  actionUrl: string;
  color: string;
}

const urlPattern = /https?:\/\/[^\s<>"')]+/gi;
const imagePattern = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;

function trimUrl(url: string) {
  return url.replace(/[.,!?;:]+$/, "");
}

function getHostName(url: URL) {
  return url.hostname.replace(/^www\./, "");
}

function streamChannelFromPath(url: URL) {
  const [channel] = url.pathname.split("/").filter(Boolean);
  return channel ?? "";
}

export function extractMessageEmbeds(content: string): MessageEmbed[] {
  const urls = Array.from(new Set((content.match(urlPattern) ?? []).map(trimUrl))).slice(0, 4);
  const embeds: MessageEmbed[] = [];

  for (const rawUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }

    const host = getHostName(parsed);
    if (host === "twitch.tv") {
      const channel = streamChannelFromPath(parsed);
      if (!channel || ["videos", "directory", "p"].includes(channel.toLowerCase())) continue;
      embeds.push({
        type: "twitch",
        url: rawUrl,
        providerName: "Twitch",
        title: `${channel} on Twitch`,
        description: "Open this Twitch channel or live stream.",
        thumbnailUrl: null,
        actionLabel: "Watch Stream",
        actionUrl: `https://www.twitch.tv/${channel}`,
        color: "#9146ff",
      });
      continue;
    }

    if (host === "kick.com") {
      const channel = streamChannelFromPath(parsed);
      if (!channel || ["video", "categories"].includes(channel.toLowerCase())) continue;
      embeds.push({
        type: "kick",
        url: rawUrl,
        providerName: "Kick",
        title: `${channel} on Kick`,
        description: "Open this Kick channel or live stream.",
        thumbnailUrl: null,
        actionLabel: "Watch Stream",
        actionUrl: `https://kick.com/${channel}`,
        color: "#53fc18",
      });
      continue;
    }

    if (imagePattern.test(parsed.pathname)) {
      embeds.push({
        type: "image",
        url: rawUrl,
        providerName: host,
        title: host,
        description: null,
        thumbnailUrl: rawUrl,
        actionLabel: "Open Image",
        actionUrl: rawUrl,
        color: "#7c6af7",
      });
      continue;
    }

    embeds.push({
      type: "link",
      url: rawUrl,
      providerName: host,
      title: parsed.pathname === "/" ? host : `${host}${parsed.pathname}`,
      description: rawUrl,
      thumbnailUrl: null,
      actionLabel: "Open Link",
      actionUrl: rawUrl,
      color: "#7c6af7",
    });
  }

  return embeds;
}
