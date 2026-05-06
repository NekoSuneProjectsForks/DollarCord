import { prisma } from "@/lib/prisma";
import type { MemberRole } from "@/types";

export async function getServerMember(serverId: string, userId: string) {
  return prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
  });
}

export function isServerManager(role: string | null | undefined) {
  return role === "OWNER" || role === "ADMIN";
}

export function asMemberRole(role: string): MemberRole {
  return role as MemberRole;
}
