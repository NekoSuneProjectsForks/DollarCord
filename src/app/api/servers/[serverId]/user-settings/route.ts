import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerMember } from "@/lib/serverApi";
import { ensureServerUserSettings } from "@/lib/serverSettings";
import { updateServerUserSettingsSchema } from "@/lib/validations";

interface Params { params: { serverId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await ensureServerUserSettings(params.serverId, user.id);
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getServerMember(params.serverId, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateServerUserSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await ensureServerUserSettings(params.serverId, user.id);
  const settings = await prisma.serverUserSettings.update({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
    data: parsed.data,
  });

  return NextResponse.json({ settings });
}
