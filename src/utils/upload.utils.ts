import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

export function sanitizeFilename(name: string) {
  if (!name) return Date.now().toString();
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export async function saveMultipartFile(part: any, customName?: string) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(part.mimetype)) {
    throw new Error("Only image files are allowed");
  }

  const uploadDir = path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(part.filename);
  const safeName = sanitizeFilename(customName || "logo");
  const finalName = `${safeName}_${Date.now()}${ext}`;
  const fullPath = path.join(uploadDir, finalName);

  await pipeline(part.file, fs.createWriteStream(fullPath));

  return {
    dbPath: `/uploads/${finalName}`,
    fullPath,
  };
}

export function deleteFileIfExists(path: string) {
  if (path && fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}