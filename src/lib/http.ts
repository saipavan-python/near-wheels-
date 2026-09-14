import { NextRequest, NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  // NextResponse (not plain Response) so route handlers can set cookies on it.
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function readJson(req: NextRequest): Promise<Record<string, any>> {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

export function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
