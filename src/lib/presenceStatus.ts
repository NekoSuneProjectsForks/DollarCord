import type { UserStatus } from "@/types";

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

/** Whether the resolved status should read as "online" (colored dot, active text). */
export function isShownOnline(status: UserStatus): boolean {
  return status === "ONLINE" || status === "IDLE" || status === "DND";
}
