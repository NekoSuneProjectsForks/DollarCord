import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";

export const runtime = "nodejs";

// Generic OpenGraph/link unfurler. Fetches a URL and extracts og:/twitter:/title
// metadata so the client can render a link preview. Best-effort + safe-ish:
// blocks obvious internal hosts and caps the response size.

function meta(html: string, ...keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
      "i"
    );
    const tag = html.match(re)?.[0];
    if (tag) {
      const c = tag.match(/content=["']([^"']*)["']/i)?.[1];
      if (c) return c.trim();
    }
  }
  return null;
}

function isBlockedHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
    return NextResponse.json({ error: "blocked" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "DollarCord-LinkBot/1.0", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("text/html")) return NextResponse.json({ preview: null });

    const html = (await res.text()).slice(0, 200_000);
    const preview = {
      url: url.toString(),
      siteName: meta(html, "og:site_name") || url.hostname,
      title: meta(html, "og:title", "twitter:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url.hostname,
      description: meta(html, "og:description", "twitter:description", "description"),
      image: meta(html, "og:image", "twitter:image"),
    };
    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ preview: null });
  }
}
