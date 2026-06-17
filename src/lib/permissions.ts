import { prisma } from "./prisma";
import { ALL_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from "./permissionFlags";

// Re-export the pure flag constants so server code can import everything from here.
export {
  Permission,
  PERMISSION_LIST,
  ALL_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  has,
} from "./permissionFlags";
export type { PermissionName } from "./permissionFlags";

interface PermContext {
  isAdmin: boolean; // OWNER or ADMIN tier — bypasses everything
  base: number;
  roleIds: Set<string>;
}

interface OverrideRow {
  targetType: string;
  targetId: string;
  allow: number;
  deny: number;
}

/** Load the member's base permissions (tier + custom-role bits). */
export async function getPermissionContext(serverId: string, userId: string): Promise<PermContext | null> {
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    select: { role: true, roles: { select: { roleId: true, role: { select: { permissions: true } } } } },
  });
  if (!member) return null;

  if (member.role === "OWNER" || member.role === "ADMIN") {
    return { isAdmin: true, base: ALL_PERMISSIONS, roleIds: new Set() };
  }

  let base = DEFAULT_MEMBER_PERMISSIONS;
  const roleIds = new Set<string>();
  for (const r of member.roles) {
    roleIds.add(r.roleId);
    base |= r.role.permissions;
  }
  return { isAdmin: false, base, roleIds };
}

/** Apply a channel's overrides to a base permission set (Discord-style order). */
export function applyOverrides(ctx: PermContext, userId: string, overrides: OverrideRow[]): number {
  if (ctx.isAdmin) return ALL_PERMISSIONS;
  let perms = ctx.base;

  const everyone = overrides.find((o) => o.targetType === "EVERYONE");
  if (everyone) perms = (perms & ~everyone.deny) | everyone.allow;

  let allow = 0;
  let deny = 0;
  for (const o of overrides) {
    if (o.targetType === "ROLE" && ctx.roleIds.has(o.targetId)) {
      allow |= o.allow;
      deny |= o.deny;
    }
  }
  perms = (perms & ~deny) | allow;

  const member = overrides.find((o) => o.targetType === "MEMBER" && o.targetId === userId);
  if (member) perms = (perms & ~member.deny) | member.allow;

  return perms;
}

/** Effective permissions for one channel. */
export async function getChannelPermissions(channelId: string, serverId: string, userId: string): Promise<number> {
  const ctx = await getPermissionContext(serverId, userId);
  if (!ctx) return 0;
  if (ctx.isAdmin) return ALL_PERMISSIONS;
  const overrides = await prisma.channelPermissionOverride.findMany({ where: { channelId } });
  return applyOverrides(ctx, userId, overrides);
}

/** Effective permissions for every channel in a server (batched). */
export async function getServerChannelPermissions(
  serverId: string,
  userId: string
): Promise<Record<string, number>> {
  const ctx = await getPermissionContext(serverId, userId);
  if (!ctx) return {};

  const channels = await prisma.channel.findMany({ where: { serverId }, select: { id: true } });
  if (ctx.isAdmin) {
    return Object.fromEntries(channels.map((c) => [c.id, ALL_PERMISSIONS]));
  }

  const overrides = await prisma.channelPermissionOverride.findMany({
    where: { channel: { serverId } },
    select: { channelId: true, targetType: true, targetId: true, allow: true, deny: true },
  });
  const byChannel = new Map<string, OverrideRow[]>();
  for (const o of overrides) {
    const arr = byChannel.get(o.channelId) ?? [];
    arr.push(o);
    byChannel.set(o.channelId, arr);
  }

  const result: Record<string, number> = {};
  for (const c of channels) {
    result[c.id] = applyOverrides(ctx, userId, byChannel.get(c.id) ?? []);
  }
  return result;
}
