import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getCurrentUserFromReq } from "@/lib/auth";
import { resolveStoredPath } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".pdf": "application/pdf", ".txt": "text/plain",
};

// Streams uploads from a custom UPLOAD_ROOT (when it's outside ./public). Files
// under ./public are served statically and never hit this route.
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = resolveStoredPath(params.path ?? []);
  if (!target) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    const info = await stat(target);
    if (!info.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
