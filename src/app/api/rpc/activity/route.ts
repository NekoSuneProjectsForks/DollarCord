import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rpcActivitySchema } from "@/lib/validations";
import { broadcastActivities, recordActivityHistory } from "@/lib/presence";

// Discord-RPC-compatible Rich Presence ingest.
//
// A local game/app authenticates with a per-user RPC token (Authorization:
// Bearer <token>, or { token } in the body) and POSTs a Discord SetActivity-shaped
// payload. Sending { activity: null } clears presence (ClearActivity).
//
// This is the web-native analogue of Discord's local IPC pipe: instead of a
// named pipe, clients push over HTTP. A future desktop agent that scans running
// processes can use the exact same endpoint.

// Discord activity type enum -> our string types.
const TYPE_MAP: Record<number, string> = {
  0: "PLAYING",
  1: "STREAMING",
  2: "LISTENING",
  3: "WATCHING",
  4: "CUSTOM",
  5: "COMPETING",
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = rpcActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = headerToken || parsed.data.token;
  if (!token) return NextResponse.json({ error: "RPC token required" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { rpcToken: token }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Invalid RPC token" }, { status: 401 });

  const activity = parsed.data.activity;

  // ClearActivity
  if (!activity) {
    await prisma.activity.deleteMany({ where: { userId: user.id, source: "rpc" } });
    await broadcastActivities(user.id);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const type = activity.type != null ? TYPE_MAP[activity.type] ?? "PLAYING" : "PLAYING";
  const name = activity.name?.trim() || "Unknown";
  const startRaw = activity.timestamps?.start;
  const startedAt =
    startRaw != null
      ? new Date(typeof startRaw === "number" ? (startRaw < 1e12 ? startRaw * 1000 : startRaw) : startRaw)
      : new Date();

  const partySize = activity.party?.size ?? null;
  const partyCurrent = partySize && partySize.length > 0 ? partySize[0] : null;
  const partyMax = partySize && partySize.length > 1 ? partySize[1] : null;
  const joinUrl = activity.join_url ?? activity.url ?? null;

  // RPC presence auto-expires if the client stops heartbeating.
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.activity.upsert({
    where: { userId_source: { userId: user.id, source: "rpc" } },
    create: {
      userId: user.id,
      source: "rpc",
      type,
      name,
      details: activity.details ?? null,
      state: activity.state ?? null,
      url: activity.url ?? null,
      largeImage: activity.assets?.large_image ?? null,
      smallImage: activity.assets?.small_image ?? null,
      startedAt,
      expiresAt,
      joinUrl,
      partyId: activity.party?.id ?? null,
      partyCurrent,
      partyMax,
    },
    update: {
      type,
      name,
      details: activity.details ?? null,
      state: activity.state ?? null,
      url: activity.url ?? null,
      largeImage: activity.assets?.large_image ?? null,
      smallImage: activity.assets?.small_image ?? null,
      expiresAt,
      joinUrl,
      partyId: activity.party?.id ?? null,
      partyCurrent,
      partyMax,
    },
  });

  await recordActivityHistory(user.id, { type, name, largeImage: activity.assets?.large_image ?? null, details: activity.details ?? null });
  await broadcastActivities(user.id);
  return NextResponse.json({ ok: true });
}
