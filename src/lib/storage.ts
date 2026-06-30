import path from "path";

// Upload storage roots. Self-hosters running several communities on one node can
// point UPLOAD_ROOT at a data volume; files are then namespaced per-server
// (<root>/<serverId>/<file>) so each server's data lives under its own path.
//
// When the root stays under ./public it is served statically (fast). A custom
// root outside ./public is streamed through /api/files (still per-server).

const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");

export function uploadRoot(): string {
  return process.env.UPLOAD_ROOT ? path.resolve(process.env.UPLOAD_ROOT) : PUBLIC_UPLOADS;
}

export function isPublicRoot(): boolean {
  const root = uploadRoot();
  const publicDir = path.join(process.cwd(), "public");
  const rel = path.relative(publicDir, root);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Namespace for a stored file: the server id, or "shared" for DMs/no server. */
export function storageNamespace(serverId?: string | null): string {
  if (!serverId || !/^[a-z0-9]+$/i.test(serverId)) return "shared";
  return serverId;
}

/** Absolute directory a file should be written to. */
export function storageDir(serverId?: string | null): string {
  return path.join(uploadRoot(), storageNamespace(serverId));
}

/** Public URL for a stored file given its namespace + filename. */
export function publicUrl(namespace: string, filename: string): string {
  if (isPublicRoot()) {
    // Served statically from /public/uploads.
    const root = uploadRoot();
    const publicDir = path.join(process.cwd(), "public");
    const rel = path.relative(publicDir, root).split(path.sep).join("/");
    return `/${rel}/${namespace}/${filename}`;
  }
  return `/api/files/${namespace}/${filename}`;
}

/** Resolve + validate a relative request path against the upload root (anti-traversal). */
export function resolveStoredPath(relativeParts: string[]): string | null {
  const root = uploadRoot();
  const target = path.resolve(root, ...relativeParts);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}
