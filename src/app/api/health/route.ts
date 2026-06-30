import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deploymentMode } from "@/lib/cloud";

// Liveness/readiness probe for containers and load balancers.
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", db, mode: deploymentMode(), time: new Date().toISOString() },
    { status: db ? 200 : 503 }
  );
}
