import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStatusSchema } from "@/lib/validations";
import { broadcastStatus } from "@/lib/presence";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    });

    if (parsed.data.status) broadcastStatus(user.id, parsed.data.status);

    const { passwordHash: _, ...safeUser } = updated;
    return NextResponse.json({ user: safeUser });
  } catch (err) {
    console.error("[users/me/status PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
