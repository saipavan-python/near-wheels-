import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Liveness probe — the process is up and can answer. */
export async function GET() {
  return NextResponse.json({ ok: true, status: "ok" });
}