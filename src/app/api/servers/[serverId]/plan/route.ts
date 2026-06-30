import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlan, isSelfHosted, selfHostFreeForever, SELF_HOST_SUPPORT, SELF_HOST_FREE_CUTOFF, PLANS } from "@/lib/plans";
import { z } from "zod";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const server = await prisma.server.findUnique({
    where: { id: params.serverId },
    select: { plan: true },
  });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = resolvePlan(server.plan);

  const [memberCount, channels, storage] = await Promise.all([
    prisma.serverMember.count({ where: { serverId: params.serverId } }),
    prisma.channel.findMany({ where: { serverId: params.serverId }, select: { type: true } }),
    prisma.attachment.aggregate({ _sum: { size: true }, where: { message: { channel: { serverId: params.serverId } } } }),
  ]);
  const voiceChannels = channels.filter((c) => c.type === "VOICE").length;

  return NextResponse.json({
    planId: server.plan,
    plan,
    selfHosted: isSelfHosted(),
    freeForever: isSelfHosted() && selfHostFreeForever(),
    freeCutoff: SELF_HOST_FREE_CUTOFF,
    support: SELF_HOST_SUPPORT,
    catalog: PLANS,
    usage: {
      members: memberCount,
      voiceChannels,
      textChannels: channels.length - voiceChannels,
      storageBytes: storage._sum.size ?? 0,
    },
  });
}

const setPlanSchema = z.object({ plan: z.enum(["FREE", "GOLD"]) });

// Set a server's plan. On a cloud deployment a billing webhook would call this;
// for now the owner/platform-admin can switch it (the $5 self-serve checkout is a
// documented next step — see TODO §9). Self-hosted nodes ignore the stored plan.
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const server = await prisma.server.findUnique({ where: { id: params.serverId }, select: { ownerId: true } });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (server.ownerId !== user.id && !user.isPlatformAdmin) {
    return NextResponse.json({ error: "Only the owner can change the plan" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = setPlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const updated = await prisma.server.update({
    where: { id: params.serverId },
    data: {
      plan: parsed.data.plan,
      planRenewsAt: parsed.data.plan === "GOLD" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    },
    select: { plan: true },
  });

  return NextResponse.json({ planId: updated.plan, plan: resolvePlan(updated.plan) });
}
