// Server plan tiers (GameVox-style), enforced across the app.
//
//   FREE         — the free "Standard" tier
//   GOLD         — $5/mo paid tier
//   SELF_HOSTED  — applied to EVERY server when the node runs with SELF_HOSTED=true.
//                  Unlimited everything + all features, and then some (better than
//                  GameVox's self-hosted): higher bitrate, 4K share, unlimited file
//                  size, API access, custom branding.
//
// A limit of `null` means unlimited.

export type PlanId = "FREE" | "GOLD" | "SELF_HOSTED";

export interface PlanFeatures {
  screenShareVideo: boolean;
  screenShareMax: string; // e.g. "720p30" | "1080p60" | "1440p60" | "2160p60"
  aiVoiceIsolation: boolean;
  musicDjKbps: number;
  videoDj: boolean;
  gameOverlay: boolean;
  spatialAudio: boolean; // "GameLink" analogue
  serverApplications: boolean;
  serverUserProfiles: boolean;
  // Self-hosted exclusives (better than GameVox):
  customBranding: boolean;
  apiAccess: boolean;
  prioritySignaling: boolean;
}

export interface PlanLimits {
  id: PlanId;
  name: string;
  priceUsd: number; // monthly; 0 for free/self-host
  maxMembers: number | null;
  maxVoiceChannels: number | null;
  maxTextChannels: number | null;
  voiceBitrateKbps: number;
  storageBytes: number | null;
  maxFileBytes: number | null;
  soundboardSlots: number;
  customEmojis: number | null;
  features: PlanFeatures;
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const PLANS: Record<PlanId, PlanLimits> = {
  FREE: {
    id: "FREE",
    name: "Standard",
    priceUsd: 0,
    maxMembers: 50,
    maxVoiceChannels: 3,
    maxTextChannels: 8,
    voiceBitrateKbps: 64,
    storageBytes: 2 * GB,
    maxFileBytes: 500 * MB,
    soundboardSlots: 8,
    customEmojis: 0,
    features: {
      screenShareVideo: true,
      screenShareMax: "720p30",
      aiVoiceIsolation: true,
      musicDjKbps: 64,
      videoDj: false,
      gameOverlay: true,
      spatialAudio: true,
      serverApplications: false,
      serverUserProfiles: false,
      customBranding: false,
      apiAccess: false,
      prioritySignaling: false,
    },
  },
  GOLD: {
    id: "GOLD",
    name: "Gold",
    priceUsd: 5,
    maxMembers: 500,
    maxVoiceChannels: 18,
    maxTextChannels: 32,
    voiceBitrateKbps: 128,
    storageBytes: 50 * GB,
    maxFileBytes: 2 * GB,
    soundboardSlots: 32,
    customEmojis: 300,
    features: {
      screenShareVideo: true,
      screenShareMax: "1080p60",
      aiVoiceIsolation: true,
      musicDjKbps: 128,
      videoDj: true,
      gameOverlay: true,
      spatialAudio: true,
      serverApplications: true,
      serverUserProfiles: true,
      customBranding: false,
      apiAccess: false,
      prioritySignaling: false,
    },
  },
  SELF_HOSTED: {
    id: "SELF_HOSTED",
    name: "Self-Hosted",
    priceUsd: 0,
    maxMembers: null,
    maxVoiceChannels: null,
    maxTextChannels: null,
    voiceBitrateKbps: 384, // beyond GameVox's 256
    storageBytes: null,
    maxFileBytes: null,
    soundboardSlots: 64,
    customEmojis: null,
    features: {
      screenShareVideo: true,
      screenShareMax: "2160p60", // 4K — better than GameVox's 1440p
      aiVoiceIsolation: true,
      musicDjKbps: 320,
      videoDj: true,
      gameOverlay: true,
      spatialAudio: true,
      serverApplications: true,
      serverUserProfiles: true,
      customBranding: true,
      apiAccess: true,
      prioritySignaling: true,
    },
  },
};

// Self-hosted early-adopter window: free forever if the node was activated before
// this cutoff (mirrors GameVox's "free forever if created before July 1, 2026").
export const SELF_HOST_FREE_CUTOFF = "2026-07-01T00:00:00.000Z";
export const SELF_HOST_SUPPORT = { monthlyUsd: 2, yearlyUsd: 15 };

export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === "true" || process.env.SELF_HOSTED === "1";
}

/** Resolve the effective plan for a server. Self-hosted nodes unlock everything. */
export function resolvePlan(serverPlan: string | null | undefined): PlanLimits {
  if (isSelfHosted()) return PLANS.SELF_HOSTED;
  const id = (serverPlan as PlanId) || "FREE";
  return PLANS[id] ?? PLANS.FREE;
}

/** True when this self-host qualifies for the free-forever early-adopter window. */
export function selfHostFreeForever(): boolean {
  const activated = process.env.SELF_HOST_ACTIVATED_AT;
  const at = activated ? Date.parse(activated) : Date.now();
  return at < Date.parse(SELF_HOST_FREE_CUTOFF);
}

export function withinLimit(value: number, limit: number | null): boolean {
  return limit === null || value < limit;
}
