import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { requestPasswordResetSchema } from "@/lib/validations";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Request a password reset. Always responds 200 (no account enumeration).
// In production, email the link instead of returning the token. Until an email
// transport is wired up, we surface the token in dev only so the flow is usable.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestPasswordResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

    let devToken: string | null = null;
    if (user) {
      const token = randomBytes(32).toString("hex");
      devToken = token;
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      // TODO: replace with real email transport.
      console.log(`[password-reset] reset link for ${user.email}: ${link}`);
    }

    const payload: { ok: true; devToken?: string } = { ok: true };
    if (process.env.NODE_ENV !== "production" && devToken) payload.devToken = devToken;
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[password-reset POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
