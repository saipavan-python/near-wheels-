// Simple in-memory rate limiter (P0 critical, P3 would move to Redis)
// For MVP, per-instance; for scale, replace with Redis or Upstash.
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const oldest = arr[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { allowed: true, remaining: limit - arr.length };
}

// Helper to get IP from request
export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    // Trust the RIGHTMOST entry: a load balancer (Cloud Run, Cloudflare, ALB)
    // appends the real client address after any client-supplied value, so the
    // leftmost entry is attacker-influenced. When not behind a proxy, the
    // header is absent and we fall through below.
    const parts = xf.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // NextRequest has ip property in some runtimes
  const anyReq = req as any;
  if (anyReq.ip) return String(anyReq.ip);
  return "unknown";
}

// Clean up old entries every 5 minutes to prevent memory leak
let lastCleanup = Date.now();
function maybeCleanup() {
  if (Date.now() - lastCleanup < 5 * 60_000) return;
  lastCleanup = Date.now();
  const now = Date.now();
  for (const [k, arr] of buckets.entries()) {
    const filtered = arr.filter((t) => now - t < 10 * 60_000);
    if (filtered.length === 0) buckets.delete(k);
    else buckets.set(k, filtered);
  }
}
setInterval(maybeCleanup, 5 * 60_000).unref?.();
