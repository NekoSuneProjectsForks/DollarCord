import { createHash, randomBytes } from "crypto";

export function createBotToken() {
  return `dc_bot_${randomBytes(32).toString("base64url")}`;
}

export function hashBotToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readBotToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (!["bot", "bearer"].includes(scheme.toLowerCase())) return null;
  return token;
}
