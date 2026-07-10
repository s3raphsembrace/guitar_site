import { ObjectId } from "mongodb";
import clientPromise from "@/server/db/client";
import type {
  AssetDocument,
  LevelImportJobDocument,
  LevelVersionDocument,
  UserLevelDocument,
} from "@/types/level-import";

const DB_NAME = process.env.GUITAR_DB_NAME ?? "guitar_academy";

export const IMPORT_COLLECTIONS = {
  assets: "assets",
  userLevels: "user_levels",
  importJobs: "level_import_jobs",
  levelVersions: "level_versions",
} as const;

let ensureIndexesPromise: Promise<void> | null = null;

async function getDb() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export async function getImportCollections() {
  const db = await getDb();
  return {
    db,
    assets: db.collection<AssetDocument>(IMPORT_COLLECTIONS.assets),
    userLevels: db.collection<UserLevelDocument>(IMPORT_COLLECTIONS.userLevels),
    importJobs: db.collection<LevelImportJobDocument>(IMPORT_COLLECTIONS.importJobs),
    levelVersions: db.collection<LevelVersionDocument>(IMPORT_COLLECTIONS.levelVersions),
  };
}

export function toObjectId(id: string, fieldName = "id"): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return new ObjectId(id);
}

export async function ensureLevelImportIndexes() {
  if (ensureIndexesPromise) {
    return ensureIndexesPromise;
  }

  ensureIndexesPromise = (async () => {
    const { assets, importJobs, levelVersions, userLevels } = await getImportCollections();

    await Promise.all([
      assets.createIndexes([
        { key: { ownerUserId: 1, createdAt: -1 }, name: "assets_owner_createdAt" },
      ]),
      userLevels.createIndexes([
        { key: { id: 1 }, name: "user_levels_id_unique", unique: true },
        { key: { ownerUserId: 1, updatedAt: -1 }, name: "user_levels_owner_updatedAt" },
        { key: { status: 1, updatedAt: -1 }, name: "user_levels_status_updatedAt" },
      ]),
      importJobs.createIndexes([
        { key: { ownerUserId: 1, createdAt: -1 }, name: "import_jobs_owner_createdAt" },
        { key: { status: 1, createdAt: 1 }, name: "import_jobs_status_createdAt" },
        { key: { lockedAt: 1 }, name: "import_jobs_lockedAt" },
      ]),
      levelVersions.createIndexes([
        {
          key: { levelId: 1, versionNumber: -1 },
          name: "level_versions_level_version",
          unique: true,
        },
        { key: { levelId: 1, status: 1 }, name: "level_versions_level_status" },
      ]),
    ]);
  })().catch((error) => {
    ensureIndexesPromise = null;
    throw error;
  });

  return ensureIndexesPromise;
}
