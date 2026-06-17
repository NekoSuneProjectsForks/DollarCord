// Pure permission constants — safe to import in client components (no prisma).

export const Permission = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  MANAGE_CHANNELS: 1 << 3,
  MANAGE_ROLES: 1 << 4,
  KICK_MEMBERS: 1 << 5,
  BAN_MEMBERS: 1 << 6,
  MENTION_EVERYONE: 1 << 7,
  MANAGE_SERVER: 1 << 8,
  CREATE_INVITE: 1 << 9,
  ATTACH_FILES: 1 << 10,
  ADD_REACTIONS: 1 << 11,
  MANAGE_THREADS: 1 << 12,
  MANAGE_EVENTS: 1 << 13,
} as const;

export type PermissionName = keyof typeof Permission;

export const PERMISSION_LIST: { key: PermissionName; label: string; bit: number }[] = [
  { key: "VIEW_CHANNEL", label: "View Channel", bit: Permission.VIEW_CHANNEL },
  { key: "SEND_MESSAGES", label: "Send Messages", bit: Permission.SEND_MESSAGES },
  { key: "ADD_REACTIONS", label: "Add Reactions", bit: Permission.ADD_REACTIONS },
  { key: "ATTACH_FILES", label: "Attach Files", bit: Permission.ATTACH_FILES },
  { key: "MENTION_EVERYONE", label: "Mention @everyone", bit: Permission.MENTION_EVERYONE },
  { key: "MANAGE_THREADS", label: "Manage Threads", bit: Permission.MANAGE_THREADS },
  { key: "MANAGE_MESSAGES", label: "Manage Messages", bit: Permission.MANAGE_MESSAGES },
  { key: "MANAGE_CHANNELS", label: "Manage Channels", bit: Permission.MANAGE_CHANNELS },
  { key: "MANAGE_ROLES", label: "Manage Roles", bit: Permission.MANAGE_ROLES },
  { key: "MANAGE_EVENTS", label: "Manage Events", bit: Permission.MANAGE_EVENTS },
  { key: "CREATE_INVITE", label: "Create Invite", bit: Permission.CREATE_INVITE },
  { key: "KICK_MEMBERS", label: "Kick Members", bit: Permission.KICK_MEMBERS },
  { key: "BAN_MEMBERS", label: "Ban Members", bit: Permission.BAN_MEMBERS },
  { key: "MANAGE_SERVER", label: "Manage Server", bit: Permission.MANAGE_SERVER },
];

export const ALL_PERMISSIONS = PERMISSION_LIST.reduce((acc, p) => acc | p.bit, 0);

export const DEFAULT_MEMBER_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.ADD_REACTIONS |
  Permission.ATTACH_FILES |
  Permission.CREATE_INVITE;

export function has(perms: number, flag: number): boolean {
  return (perms & flag) === flag;
}
