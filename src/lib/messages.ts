import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// Shared include so every message-returning route hydrates the same shape.
export const MESSAGE_INCLUDE = {
  user: true,
  bot: true,
  reactions: { include: { user: true } },
  replyTo: { include: { user: true, bot: true } },
  attachments: true,
  mentions: true,
} satisfies Prisma.MessageInclude;

const MENTION_RE = /@([a-zA-Z0-9_.-]{2,32})/g;

export interface ParsedMentions {
  userIds: string[];
  mentionsEveryone: boolean;
}

/**
 * Resolve @username mentions to member user ids within a server, and detect
 * @everyone / @here. Only usernames that belong to a member of the server are
 * counted, so a stray "@foo" never pings a stranger.
 */
export async function parseMentions(content: string, serverId: string): Promise<ParsedMentions> {
  const mentionsEveryone = /(^|\s)@(everyone|here)\b/.test(content);

  const usernames = new Set<string>();
  for (const match of Array.from(content.matchAll(MENTION_RE))) {
    const name = match[1].toLowerCase();
    if (name === "everyone" || name === "here") continue;
    usernames.add(name);
  }

  if (usernames.size === 0) return { userIds: [], mentionsEveryone };

  // SQLite `in` is case-sensitive, so match usernames case-insensitively in JS.
  const members = await prisma.serverMember.findMany({
    where: { serverId },
    select: { userId: true, user: { select: { username: true } } },
  });

  const userIds = members
    .filter((m) => usernames.has(m.user.username.toLowerCase()))
    .map((m) => m.userId);

  return { userIds, mentionsEveryone };
}
