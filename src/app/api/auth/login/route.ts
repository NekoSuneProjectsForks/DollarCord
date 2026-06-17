import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Brute-force guard: 10 attempts / 5 min per IP.
    const limit = rateLimit(`login:${clientIp(req)}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!compareSync(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    const { passwordHash: _, ...safeUser } = user;

    const response = NextResponse.json({ user: safeUser, token });
    response.cookies.set("dollarcord_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
