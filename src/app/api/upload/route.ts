import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUserFromReq } from "@/lib/auth";
import { storageDir, storageNamespace, publicUrl } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

function safeExt(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length > 1 && ext.length <= 8 ? ext : "";
}

// Accepts a single multipart file and stores it under the (per-server) upload
// root, returning metadata the client attaches to a message. The optional
// `serverId` field namespaces the file so each server's data lives in its own
// directory — making it easy to host several communities on one node.
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const serverId = typeof form?.get("serverId") === "string" ? (form.get("serverId") as string) : null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large (max 25 MB)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}_${randomBytes(8).toString("hex")}${safeExt(file.name)}`;
  const namespace = storageNamespace(serverId);

  await mkdir(storageDir(serverId), { recursive: true });
  await writeFile(path.join(storageDir(serverId), filename), bytes);

  return NextResponse.json({
    url: publicUrl(namespace, filename),
    name: file.name.slice(0, 256),
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
}
