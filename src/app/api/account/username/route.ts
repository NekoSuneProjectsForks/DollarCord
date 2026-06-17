import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeUsernameSchema } from "@/lib/validations";

const CHANGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between username changes

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = changeUsernameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { username } = parsed.data;

    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true, usernameChangedAt: true },
    });
    if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (current.username === username) {
      return NextResponse.json({ error: "That is already your username" }, { status: 400 });
    }

    if (
      current.usernameChangedAt &&
      Date.now() - current.usernameChangedAt.getTime() < CHANGE_COOLDOWN_MS
    ) {
      const mins = Math.ceil(
        (CHANGE_COOLDOWN_MS - (Date.now() - current.usernameChangedAt.getTime())) / 60000
      );
      return NextResponse.json(
        { error: `You changed your username recently. Try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) return NextResponse.json({ error: "That username is taken" }, { status: 409 });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username, usernameChangedAt: new Date() },
    });

    const { passwordHash: _, ...safeUser } = updated;
    return NextResponse.json({ user: safeUser });
  } catch (err) {
    console.error("[account/username PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
