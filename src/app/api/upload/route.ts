import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUserFromReq } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function safeExt(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length > 1 && ext.length <= 8 ? ext : "";
}

// Accepts a single multipart file and stores it under /public/uploads, returning
// metadata the client then attaches to a message. Local-disk storage keeps the
// app self-hostable with zero external dependencies (swap for S3/R2 later).
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large (max 25 MB)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}_${randomBytes(8).toString("hex")}${safeExt(file.name)}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    name: file.name.slice(0, 256),
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
}
