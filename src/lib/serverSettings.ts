import { prisma } from "@/lib/prisma";

export async function ensureServerUserSettings(serverId: string, userId: string) {
  return prisma.serverUserSettings.upsert({
    where: { serverId_userId: { serverId, userId } },
    update: {},
    create: { serverId, userId },
  });
}

export async function canUserStartDmWithTarget(actorUserId: string, targetUserId: string) {
  const actorMemberships = await prisma.serverMember.findMany({
    where: { userId: actorUserId },
    select: { serverId: true },
  });
  if (actorMemberships.length === 0) return { allowed: true };

  const sharedMemberships = await prisma.serverMember.findMany({
    where: {
      userId: targetUserId,
      serverId: { in: actorMemberships.map((member) => member.serverId) },
    },
    include: { server: true },
  });
  if (sharedMemberships.length === 0) return { allowed: true };

  const blocked = await prisma.serverUserSettings.findFirst({
    where: {
      userId: targetUserId,
      allowDms: false,
      serverId: { in: sharedMemberships.map((member) => member.serverId) },
    },
    include: { server: true },
  });

  if (!blocked) return { allowed: true };
  return {
    allowed: false,
    reason: `${blocked.server.name} blocks direct messages from server members for this user.`,
  };
}
