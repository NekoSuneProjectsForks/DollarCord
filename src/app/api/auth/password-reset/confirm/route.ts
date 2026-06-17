import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { confirmPasswordResetSchema } from "@/lib/validations";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmPasswordResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { token, newPassword } = parsed.data;
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashSync(newPassword, 10) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate every session — force re-login with the new password.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[password-reset/confirm POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
