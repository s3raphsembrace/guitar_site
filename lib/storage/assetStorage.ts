import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface SaveAssetInput {
  ownerUserId: string;
  fileName: string;
  bytes: Buffer;
}

export interface SavedAsset {
  storageProvider: "local" | "s3" | "r2";
  storagePath: string;
  publicUrl: string;
  absolutePath: string;
}

export interface AssetStorage {
  saveFile(input: SaveAssetInput): Promise<SavedAsset>;
  resolveAbsolutePath(storagePath: string): string;
}

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildRelativePath(ownerUserId: string, fileName: string) {
  const ext = path.extname(fileName) || "";
  const base = path.basename(fileName, ext);
  const safeName = `${sanitizeFilename(base).slice(0, 64)}_${randomUUID()}${sanitizeFilename(ext)}`;
  return path.posix.join("uploads", sanitizeFilename(ownerUserId), safeName);
}

class LocalAssetStorage implements AssetStorage {
  async saveFile(input: SaveAssetInput): Promise<SavedAsset> {
    const relativePath = buildRelativePath(input.ownerUserId, input.fileName);
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes);

    return {
      storageProvider: "local",
      storagePath: relativePath,
      publicUrl: `/${relativePath.replace(/\\/g, "/")}`,
      absolutePath,
    };
  }

  resolveAbsolutePath(storagePath: string): string {
    const normalized = storagePath.replace(/^\/+/, "");
    return path.join(process.cwd(), "public", normalized);
  }
}

let singleton: AssetStorage | null = null;

export function getAssetStorage(): AssetStorage {
  if (singleton) {
    return singleton;
  }

  if (process.env.LEVEL_ASSET_STORAGE_PROVIDER === "s3" || process.env.LEVEL_ASSET_STORAGE_PROVIDER === "r2") {
    throw new Error("S3/R2 storage adapter not configured yet");
  }

  singleton = new LocalAssetStorage();
  return singleton;
}

export async function ensureLocalUploadDir() {
  await mkdir(LOCAL_UPLOAD_ROOT, { recursive: true });
}
