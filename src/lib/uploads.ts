import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function saveImageFile(file: File, businessId: string): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Vercel and Render instances have ephemeral filesystems. Use shared object
  // storage in production, while retaining local uploads for development.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${businessId}/${filename}`, buffer, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads", businessId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${businessId}/${filename}`;
}
