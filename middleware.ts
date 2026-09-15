import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Assign a request id to every request so logs and errors can be correlated,
 * and echo it back in the response for client-side debugging.
 */
export function middleware(request: NextRequest) {
  const incoming = request.headers.get("x-request-id") || "";
  const requestId = UUID_RE.test(incoming) ? incoming : crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|uploads/|robots.txt|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js|woff2?)$).*)",
  ],
};