const TEMPLATE_CODE_PATTERN = /(?:discord\.new\/|discord(?:app)?\.com\/template\/|discord(?:app)?\.com\/guild-template\/)?([a-zA-Z0-9-]{2,})/;

export interface DiscordTemplateChannel {
  id?: number | string;
  parent_id?: number | string | null;
  name?: string;
  type?: number;
  topic?: string | null;
  position?: number;
}

export interface DiscordTemplateRole {
  id?: number;
  name?: string;
  color?: number;
  position?: number;
  hoist?: boolean;
}

export interface DiscordTemplate {
  code: string;
  name?: string;
  serialized_source_guild?: {
    name?: string;
    description?: string | null;
    channels?: DiscordTemplateChannel[];
    roles?: DiscordTemplateRole[];
  };
}

/** Convert a Discord integer color (0 = no color) to a hex string. */
export function discordColorToHex(color: number | undefined): string {
  if (!color || color <= 0) return "#7c6af7";
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function extractDiscordTemplateCode(input: string) {
  const match = input.trim().match(TEMPLATE_CODE_PATTERN);
  return match?.[1] ?? null;
}

export function normalizeChannelName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export async function fetchDiscordTemplate(code: string) {
  const res = await fetch(`https://discord.com/api/v10/guilds/templates/${encodeURIComponent(code)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;
  return (await res.json()) as DiscordTemplate;
}
