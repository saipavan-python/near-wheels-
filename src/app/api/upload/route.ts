import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_EDGE = 1600; // longest edge in px after resize
const WEBP_QUALITY = 82; // visually lossless-to-near-lossless for photos

function isValidImageMagic(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  // WebP: RIFF xxxx WEBP
  if (mime === "image/webp") {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  return false;
}

/**
 * POST /api/upload
 * Accepts a multipart form with a single file field named "file".
 * Saves to public/uploads/ and returns the public URL.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Login required to upload" }, { status: 401 });

    const ip = getClientIp(req);
    const rl = checkRateLimit(`upload:${session.userId}:${ip}`, 10, 60_000);
    if (!rl.allowed) return NextResponse.json({ ok: false, error: "Too many uploads. Try again shortly." }, { status: 429 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only JPEG, PNG and WebP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "File size must be under 5 MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!isValidImageMagic(buffer, file.type)) {
      return NextResponse.json({ ok: false, error: "File content does not match image type" }, { status: 400 });
    }

    // Compress on save: auto-orient, downscale >1600px, encode to WebP (strip EXIF/GPS)
    const pipeline = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata().catch(() => null);
    const needsResize = !!meta && Math.max(meta.width || 0, meta.height || 0) > MAX_EDGE;
    if (needsResize && meta) {
      pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
    }
    let outBuffer: Buffer | null = null;
    try {
      outBuffer = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
    } catch {
      outBuffer = null;
    }
    // Fallback to original bytes if encode fails (e.g. pathological input) so uploads never hard-fail.
    const finalBuffer = outBuffer || buffer;

    // Sanitize extension from mime, not filename (re-encoded output is always WebP)
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, finalBuffer);

    const url = `/uploads/${filename}`;

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("Upload error");
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
