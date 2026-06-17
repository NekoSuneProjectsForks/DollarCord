import { prisma } from "./prisma";

export interface AutomodResult {
  blocked: boolean;
  reason?: string;
}

const INVITE_RE = /(discord\.gg\/|discord(?:app)?\.com\/invite\/|\/invite\/[a-zA-Z0-9]+)/i;

/**
 * Run a server's AutoMod rules against an outgoing message. Returns
 * `{ blocked: true, reason }` when the message should be rejected. Managers can
 * be exempted by the caller.
 */
export async function runAutomod(
  serverId: string,
  content: string,
  mentionCount: number
): Promise<AutomodResult> {
  const cfg = await prisma.serverAutomod.findUnique({ where: { serverId } });
  if (!cfg || !cfg.enabled) return { blocked: false };

  const lower = content.toLowerCase();

  if (cfg.blockedWords.trim()) {
    const words = cfg.blockedWords
      .split(/[\n,]+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const hit = words.find((w) => lower.includes(w));
    if (hit) return { blocked: true, reason: "Your message was blocked by AutoMod (blocked word)." };
  }

  if (cfg.maxMentions > 0 && mentionCount > cfg.maxMentions) {
    return { blocked: true, reason: `AutoMod: too many mentions (max ${cfg.maxMentions}).` };
  }

  if (cfg.blockInvites && INVITE_RE.test(content)) {
    return { blocked: true, reason: "AutoMod: server invites aren't allowed here." };
  }

  return { blocked: false };
}
