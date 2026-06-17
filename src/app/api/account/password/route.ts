import { NextRequest, NextResponse } from "next/server";
import { compareSync, hashSync } from "bcryptjs";
import { getCurrentUserFromReq } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validations";

// Change password while logged in. Revokes all other sessions for safety.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!compareSync(currentPassword, dbUser.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const currentToken = req.cookies.get("dollarcord_session")?.value;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashSync(newPassword, 10) },
      }),
      // Revoke every other session.
      prisma.session.deleteMany({
        where: { userId: user.id, ...(currentToken ? { token: { not: currentToken } } : {}) },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/password PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
