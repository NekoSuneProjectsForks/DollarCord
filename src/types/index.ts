export type UserStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE" | "OFFLINE";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isPlatformAdmin?: boolean;
  bio: string | null;
  avatarUrl: string | null;
  twitchChannel?: string | null;
  kickChannel?: string | null;
  status?: string;
  customStatus?: string | null;
  customStatusEmoji?: string | null;
  usernameChangedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface Server {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  ownerId: string;
  liveAnnounceChannelId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: Date | string;
  user: User;
  roles?: ServerMemberRole[];
}

export interface ServerRole {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServerMemberRole {
  id: string;
  serverId: string;
  memberId: string;
  roleId: string;
  role: ServerRole;
  createdAt: Date | string;
}

export interface Bot {
  id: string;
  serverId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type ServerNotificationLevel = "ALL_MESSAGES" | "MENTIONS" | "NOTHING";

export interface ServerUserSettings {
  id: string;
  serverId: string;
  userId: string;
  allowDms: boolean;
  messageRequests: boolean;
  shareActivity: boolean;
  activityJoining: boolean;
  muted: boolean;
  notificationLevel: ServerNotificationLevel;
  suppressEveryone: boolean;
  suppressRoleMentions: boolean;
  suppressHighlights: boolean;
  muteNewEvents: boolean;
  mobilePushNotifications: boolean;
  inAppEventAlerts: boolean;
  pushEventAlerts: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServerBan {
  id: string;
  serverId: string;
  userId: string;
  bannedBy: string;
  reason: string | null;
  createdAt: Date | string;
  user: User;
  actor?: User;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  createdBy: string;
  maxUses: number | null;
  uses: number;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export type ChannelType = "TEXT" | "VOICE" | "ANNOUNCEMENT" | "FORUM";

export interface Channel {
  id: string;
  serverId: string;
  categoryId?: string | null;
  name: string;
  description: string | null;
  type?: string;
  slowmodeSeconds?: number;
  position: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Attachment {
  id: string;
  messageId?: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface ChannelUnread {
  unread: boolean;
  mentions: number;
}

export type UnreadMap = Record<string, ChannelUnread>;

export interface ServerEventParticipant {
  id: string;
  eventId: string;
  userId: string;
  notify: boolean;
  joinedAt: Date | string;
  user?: User;
}

export interface ServerEvent {
  id: string;
  serverId: string;
  channelId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date | string;
  endsAt: Date | string | null;
  createdBy: string;
  canceled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  channel?: Channel | null;
  creator?: User;
  participants?: ServerEventParticipant[];
  currentUserParticipant?: ServerEventParticipant | null;
  participantCount?: number;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user: User;
  createdAt: Date | string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string | null;
  botId?: string | null;
  content: string;
  edited: boolean;
  deleted: boolean;
  mentionsEveryone?: boolean;
  replyToId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  user: User | null;
  bot?: Bot | null;
  reactions: Reaction[];
  replyTo?: Message | null;
  attachments?: Attachment[];
  mentions?: { userId: string }[];
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  edited: boolean;
  deleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  sender: User;
}

export interface DirectMessageThread {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  participants: { user: User }[];
  messages?: DirectMessage[];
  // Computed for display
  otherUser?: User;
  lastMessage?: DirectMessage | null;
}

export interface TypingUser {
  userId: string;
  username: string;
  displayName: string;
}

export type PresenceMap = Record<string, boolean>;

export type ActivityType = "PLAYING" | "STREAMING" | "LISTENING" | "WATCHING" | "COMPETING" | "CUSTOM";

export interface Activity {
  id: string;
  source: string; // "manual" | "rpc" | "twitch" | "kick"
  type: ActivityType;
  name: string;
  details: string | null;
  state: string | null;
  url: string | null;
  largeImage: string | null;
  smallImage: string | null;
  startedAt: string | null;
  joinUrl?: string | null;
  partyCurrent?: number | null;
  partyMax?: number | null;
}

export interface UserPresence {
  status: UserStatus;
  customStatus: string | null;
  customStatusEmoji: string | null;
}

export type StatusMap = Record<string, UserPresence>;
export type ActivityMap = Record<string, Activity[]>;

export interface VoiceParticipant {
  socketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
}

export type VoiceRoomMap = Record<string, VoiceParticipant[]>;

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

export interface ServerWithDetails extends Server {
  members: ServerMember[];
  channels: Channel[];
  roles?: ServerRole[];
}

export type LiveStreamProvider = "twitch" | "kick";

export interface LiveStreamStatus {
  provider: LiveStreamProvider;
  channel: string;
  url: string;
  isLive: boolean;
  title: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  viewerCount: number | null;
  startedAt: string | null;
}

export interface ApiError {
  error: string;
}

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  cursor: string | null;
}
