import { NextResponse } from "next/server";
import { LEVEL_ASSET_KINDS, type CreateAssetResponse, type LevelAssetKind } from "@/types/level-import";
import { requireUserSession } from "@/lib/level-import/auth";
import { ensureLevelImportIndexes, getImportCollections } from "@/lib/level-import/db";
import { getAssetStorage } from "@/lib/storage/assetStorage";
import { detectSourceKindFromMimeAndName } from "@/lib/level-import/fileType";

export const runtime = "nodejs";

function isLevelAssetKind(value: string): value is LevelAssetKind {
  return LEVEL_ASSET_KINDS.includes(value as LevelAssetKind);
}

function resolveAssetKind(file: File, requestedKindRaw: string): LevelAssetKind | null {
  if (requestedKindRaw && isLevelAssetKind(requestedKindRaw)) {
    return requestedKindRaw;
  }
  const detected = detectSourceKindFromMimeAndName({
    mimeType: file.type,
    fileName: file.name,
  });
  if (detected === "midi") {
    return "midi_source";
  }
  if (detected === "audio") {
    return "audio_source";
  }
  return null;
}

function getAssetValidationError(file: File, kind: LevelAssetKind) {
  const detected = detectSourceKindFromMimeAndName({
    mimeType: file.type,
    fileName: file.name,
  });
  if (kind === "midi_source" && detected !== "midi") {
    return "MIDI source must be a .mid or .midi file.";
  }
  if ((kind === "audio_source" || kind === "audio_preview" || kind === "audio_stem") && detected !== "audio") {
    return "Audio assets must be a supported audio file (mp3/wav/ogg/etc), not MIDI.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await ensureLevelImportIndexes();
    const { userId } = await requireUserSession();
    const form = await request.formData();
    const file = form.get("file");
    const requestedKindRaw = String(form.get("kind") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json<CreateAssetResponse>(
        { ok: false, message: "Please select a file before uploading." },
        { status: 400 },
      );
    }

    const kind = resolveAssetKind(file, requestedKindRaw);
    if (!kind) {
      return NextResponse.json<CreateAssetResponse>(
        {
          ok: false,
          message: "Unsupported source file type. Please upload a MIDI file or supported audio file.",
        },
        { status: 400 },
      );
    }

    const validationError = getAssetValidationError(file, kind);
    if (validationError) {
      return NextResponse.json<CreateAssetResponse>(
        { ok: false, message: validationError },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const storage = getAssetStorage();
    const saved = await storage.saveFile({
      ownerUserId: userId,
      fileName: file.name,
      bytes,
    });

    const now = new Date();
    const { assets } = await getImportCollections();
    const insert = await assets.insertOne({
      ownerUserId: userId,
      kind,
      storageProvider: saved.storageProvider,
      storagePath: saved.storagePath,
      publicUrl: saved.publicUrl,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: bytes.length,
      originalFilename: file.name,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json<CreateAssetResponse>({
      ok: true,
      asset: {
        id: insert.insertedId.toString(),
        kind,
        detectedSourceKind: detectSourceKindFromMimeAndName({
          mimeType: file.type,
          fileName: file.name,
        }),
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: bytes.length,
        publicUrl: saved.publicUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("logged in") ? 401 : 500;
    return NextResponse.json<CreateAssetResponse>(
      { ok: false, message },
      { status },
    );
  }
}
