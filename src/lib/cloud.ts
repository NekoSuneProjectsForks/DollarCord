import { isSelfHosted } from "./plans";

// Cloud-coordination seam (direct-to-server architecture).
//
//   Client ──voice/video/chat/files──▶ Your Server (self-host node)
//   Client / Node ──auth & coordination (lightweight)──▶ Cloud
//
// A self-host node handles ALL realtime/media/file traffic locally. The cloud is
// only used (optionally) for: account auth federation, license/early-adopter
// checks, server discovery, and update notifications. When CLOUD_URL is unset the
// node is fully standalone (its own accounts, no phone-home).
//
// This module is the integration point — wiring it into the auth flow (so a
// self-host can authenticate cloud accounts) is the federation step tracked in
// TODO §11. Default behavior is local-only so nothing breaks out of the box.

export type DeploymentMode = "cloud" | "selfhost";

export function deploymentMode(): DeploymentMode {
  return isSelfHosted() ? "selfhost" : "cloud";
}

export function cloudConfigured(): boolean {
  return Boolean(process.env.CLOUD_URL);
}

function cloudUrl(path: string): string {
  const base = (process.env.CLOUD_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Optional: verify a cloud-issued account token (federated auth). No-op locally. */
export async function verifyCloudToken(token: string): Promise<{ id: string; username: string } | null> {
  if (!cloudConfigured()) return null;
  try {
    const res = await fetch(cloudUrl("/api/federation/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ node: process.env.NODE_ID || "self-host" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { id: string; username: string };
  } catch {
    return null;
  }
}

/** Optional: announce this node to the cloud (discovery + license/early-adopter). */
export async function reportNodeHeartbeat(): Promise<void> {
  if (!cloudConfigured()) return;
  try {
    await fetch(cloudUrl("/api/federation/heartbeat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: process.env.NODE_ID || "self-host",
        mode: deploymentMode(),
        activatedAt: process.env.SELF_HOST_ACTIVATED_AT || null,
      }),
    });
  } catch {
    /* coordination is best-effort; the node keeps running regardless */
  }
}
