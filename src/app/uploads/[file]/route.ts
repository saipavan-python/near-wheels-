import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");

/**
 * GET /uploads/[file]
 * Serves provider-uploaded images from the private data/uploads dir.
 * Public URLs are unchanged (/uploads/<unique-name>); filenames are
 * timestamp+random so they are immutable and safe to cache long-term.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  file: string  }> }
) {
  const name = (await params).file || "";
  // Reject path traversal / dotfiles / non-file names
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || name.startsWith(".")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filePath = path.join(uploadsDir, name);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = path.extname(name).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}