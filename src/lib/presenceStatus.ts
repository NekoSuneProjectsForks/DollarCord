import type { Activity, UserStatus } from "@/types";

// Resolves what status to SHOW for a user, combining their live connection state
// with their chosen status:
//   - not connected            → OFFLINE
//   - connected + INVISIBLE    → OFFLINE to others (the user themselves still sees INVISIBLE)
//   - connected + DND/IDLE     → that status
//   - connected + ONLINE/unset → ONLINE
export function effectiveStatus(opts: {
  connected: boolean;
  chosenStatus?: string | null;
  self?: boolean;
}): UserStatus {
  const { connected, chosenStatus, self } = opts;
  if (!connected) return "OFFLINE";
  if (chosenStatus === "INVISIBLE") return self ? "INVISIBLE" : "OFFLINE";
  if (chosenStatus === "IDLE" || chosenStatus === "DND" || chosenStatus === "ONLINE") return chosenStatus;
  return "ONLINE";
}

export function hasLiveStream(activities?: Activity[] | null): boolean {
  return Array.isArray(activities) && activities.some((a) => a.type === "STREAMING");
}

/**
 * The status to render for the presence dot. A live stream overrides everything
 * with "STREAMING" (purple). Streaming is transient — it never enters history.
 * Returns one of: STREAMING | ONLINE | IDLE | DND | INVISIBLE | OFFLINE.
 */
export function displayStatus(opts: {
  connected: boolean;
  chosenStatus?: string | null;
  activities?: Activity[] | null;
  self?: boolean;
}): string {
  if (opts.connected && hasLiveStream(opts.activities)) return "STREAMING";
  return effectiveStatus(opts);
}

/** Whether the resolved status should read as "online" (colored dot, active text). */
export function isShownOnline(status: string): boolean {
  return status === "ONLINE" || status === "IDLE" || status === "DND" || status === "STREAMING";
}
