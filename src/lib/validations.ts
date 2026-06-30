import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, dots, and hyphens"),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(64, "Display name must be at most 64 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(256, "Bio must be at most 256 characters").nullable().optional(),
  avatarUrl: z.string().url("Invalid URL").nullable().optional(),
  twitchChannel: z
    .string()
    .trim()
    .max(25, "Twitch channel must be at most 25 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Twitch channel can only contain letters, numbers, and underscores")
    .nullable()
    .optional(),
  kickChannel: z
    .string()
    .trim()
    .max(25, "Kick channel must be at most 25 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Kick channel can only contain letters, numbers, underscores, and hyphens")
    .nullable()
    .optional(),
});

export const createServerSchema = z.object({
  name: z
    .string()
    .min(1, "Server name is required")
    .max(100, "Server name must be at most 100 characters"),
  description: z.string().max(500).nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  liveAnnounceChannelId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const joinServerSchema = z.object({
  code: z.string().min(1, "Invite code is required"),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1, "Channel name is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Channel name can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(256).nullable().optional(),
  type: z.enum(["TEXT", "VOICE", "ANNOUNCEMENT", "FORUM"]).default("TEXT").optional(),
  categoryId: z.string().nullable().optional(),
  nsfw: z.boolean().optional(),
});

export const updateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(256).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  slowmodeSeconds: z.number().int().min(0).max(21600).optional(),
  nsfw: z.boolean().optional(),
});

export const createEmojiSchema = z.object({
  name: z.string().trim().min(2).max(32).regex(/^[a-z0-9_]+$/, "Emoji name: lowercase letters, numbers, underscores"),
  url: z.string().min(1).max(1024),
});

export const friendRequestSchema = z.object({
  username: z.string().trim().min(1).max(32),
});

export const createPollSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  options: z.array(z.string().trim().min(1).max(100)).min(2, "At least 2 options").max(10),
  multiple: z.boolean().optional(),
});

export const attachmentInputSchema = z.object({
  url: z.string().min(1).max(1024),
  name: z.string().min(1).max(256),
  contentType: z.string().min(1).max(128),
  size: z.number().int().min(0).max(100 * 1024 * 1024),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(4000, "Message is too long").default(""),
    replyToId: z.string().nullable().optional(),
    attachments: z.array(attachmentInputSchema).max(10, "Too many attachments").optional(),
  })
  .refine((d) => d.content.trim().length > 0 || (d.attachments && d.attachments.length > 0), {
    message: "Message cannot be empty",
    path: ["content"],
  });

export const createThreadSchema = z.object({
  name: z.string().trim().min(1, "Thread name is required").max(100, "Thread name is too long"),
  rootMessageId: z.string().nullable().optional(),
  content: z.string().max(4000).optional(),
});

export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long"),
});

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().nullable().optional(),
  expiresInHours: z.number().int().positive().nullable().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const createServerRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(32, "Role name must be at most 32 characters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Role color must be a hex color").default("#7c6af7"),
  permissions: z.number().int().min(0).optional(),
});

export const automodSchema = z.object({
  enabled: z.boolean().optional(),
  blockedWords: z.string().max(4000).optional(),
  maxMentions: z.number().int().min(0).max(100).optional(),
  blockInvites: z.boolean().optional(),
});

export const channelPermissionsSchema = z.object({
  overrides: z
    .array(
      z.object({
        targetType: z.enum(["EVERYONE", "ROLE", "MEMBER"]),
        targetId: z.string().min(1),
        allow: z.number().int().min(0),
        deny: z.number().int().min(0),
      })
    )
    .max(100),
});

export const updateServerRoleSchema = createServerRoleSchema.partial();

export const assignServerRolesSchema = z.object({
  roleIds: z.array(z.string()).max(25, "Too many roles selected"),
});

export const createBotSchema = z.object({
  name: z.string().trim().min(1, "Bot name is required").max(64, "Bot name must be at most 64 characters"),
  username: z
    .string()
    .trim()
    .min(2, "Bot username must be at least 2 characters")
    .max(32, "Bot username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Bot username can only contain letters, numbers, underscores, dots, and hyphens"),
  avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
});

export const sendBotMessageSchema = z.object({
  channelId: z.string().min(1, "channelId required"),
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message is too long"),
});

export const updateServerUserSettingsSchema = z.object({
  allowDms: z.boolean().optional(),
  messageRequests: z.boolean().optional(),
  shareActivity: z.boolean().optional(),
  activityJoining: z.boolean().optional(),
  muted: z.boolean().optional(),
  notificationLevel: z.enum(["ALL_MESSAGES", "MENTIONS", "NOTHING"]).optional(),
  suppressEveryone: z.boolean().optional(),
  suppressRoleMentions: z.boolean().optional(),
  suppressHighlights: z.boolean().optional(),
  muteNewEvents: z.boolean().optional(),
  mobilePushNotifications: z.boolean().optional(),
  inAppEventAlerts: z.boolean().optional(),
  pushEventAlerts: z.boolean().optional(),
});

export const createServerEventSchema = z.object({
  title: z.string().trim().min(1, "Event title is required").max(100, "Event title must be at most 100 characters"),
  description: z.string().trim().max(1000, "Description must be at most 1000 characters").nullable().optional(),
  location: z.string().trim().max(120, "Location must be at most 120 characters").nullable().optional(),
  channelId: z.string().nullable().optional(),
  startsAt: z.string().datetime("Start time must be a valid date"),
  endsAt: z.string().datetime("End time must be a valid date").nullable().optional(),
});

export const updateServerEventParticipantSchema = z.object({
  notify: z.boolean(),
});

export const importDiscordTemplateSchema = z.object({
  template: z.string().trim().min(1, "Discord template link or code is required").max(300),
  importServerName: z.boolean().default(false).optional(),
  importRoles: z.boolean().default(true).optional(),
  importVoiceChannels: z.boolean().default(true).optional(),
});

// ---- Account management -----------------------------------------------------

export const changeUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, dots, and hyphens"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

// ---- Presence / activity ----------------------------------------------------

export const updateStatusSchema = z.object({
  status: z.enum(["ONLINE", "IDLE", "DND", "INVISIBLE"]).optional(),
  customStatus: z.string().trim().max(128, "Custom status must be at most 128 characters").nullable().optional(),
  customStatusEmoji: z.string().trim().max(16).nullable().optional(),
});

export const setActivitySchema = z.object({
  type: z.enum(["PLAYING", "STREAMING", "LISTENING", "WATCHING", "COMPETING", "CUSTOM"]).default("PLAYING"),
  name: z.string().trim().min(1, "Activity name is required").max(128),
  details: z.string().trim().max(128).nullable().optional(),
  state: z.string().trim().max(128).nullable().optional(),
  url: z.string().url("Invalid URL").nullable().optional(),
  largeImage: z.string().trim().max(512).nullable().optional(),
  smallImage: z.string().trim().max(512).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  joinUrl: z.string().url("Invalid join URL").nullable().optional(),
  partyCurrent: z.number().int().min(0).max(1000000).nullable().optional(),
  partyMax: z.number().int().min(0).max(1000000).nullable().optional(),
});

// Discord-RPC-compatible ingest payload (SetActivity-shaped). We accept the
// loose shape Discord game SDKs send and normalize it server-side.
export const rpcActivitySchema = z.object({
  // Either authenticate with a per-user RPC token in the body or via header.
  token: z.string().min(1).optional(),
  // `null` activity clears presence (Discord's ClearActivity).
  activity: z
    .object({
      type: z.number().int().min(0).max(6).optional(), // Discord activity type enum
      name: z.string().max(128).optional(),
      details: z.string().max(128).nullable().optional(),
      state: z.string().max(128).nullable().optional(),
      url: z.string().max(512).nullable().optional(),
      timestamps: z
        .object({ start: z.union([z.number(), z.string()]).nullable().optional() })
        .nullable()
        .optional(),
      assets: z
        .object({
          large_image: z.string().max(512).nullable().optional(),
          small_image: z.string().max(512).nullable().optional(),
        })
        .nullable()
        .optional(),
      // Discord-style party occupancy: size = [current, max].
      party: z
        .object({
          id: z.string().max(128).nullable().optional(),
          size: z.array(z.number().int()).max(2).nullable().optional(),
        })
        .nullable()
        .optional(),
      // A join target for "Join game" (web-native; Discord uses secrets.join).
      join_url: z.string().max(512).nullable().optional(),
    })
    .nullable(),
});
