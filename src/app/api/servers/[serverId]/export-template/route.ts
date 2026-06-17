import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember, isServerManager } from "@/lib/serverApi";

interface Params { params: { serverId: string } }

// Native server template export: a portable JSON snapshot of the server's
// categories, channels, and roles (no messages/members). Re-importable via
// /apply-template.
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!isServerManager(member?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const server = await prisma.server.findUnique({
    where: { id: params.serverId },
    include: {
      categories: { orderBy: { position: "asc" } },
      channels: { orderBy: { position: "asc" } },
      roles: { orderBy: { position: "asc" } },
    },
  });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const categoryName = new Map(server.categories.map((c) => [c.id, c.name]));

  const template = {
    dollarcordTemplate: 1,
    name: server.name,
    description: server.description,
    categories: server.categories.map((c) => ({ name: c.name, position: c.position })),
    channels: server.channels.map((c) => ({
      name: c.name,
      type: c.type,
      nsfw: c.nsfw,
      position: c.position,
      category: c.categoryId ? categoryName.get(c.categoryId) ?? null : null,
    })),
    roles: server.roles.map((r) => ({
      name: r.name,
      color: r.color,
      permissions: r.permissions,
      position: r.position,
    })),
  };

  return new NextResponse(JSON.stringify(template, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${server.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-template.json"`,
    },
  });
}
