import type {
  AssetDocument,
  DetectedSourceKind,
  LevelImportSourceType,
} from "@/types/level-import";

const MIDI_EXTENSIONS = [".mid", ".midi"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".webm"];

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function hasAnyExtension(fileName: string, extensions: string[]) {
  const lower = normalize(fileName);
  return extensions.some((extension) => lower.endsWith(extension));
}

export function detectSourceKindFromMimeAndName(input: {
  mimeType?: string;
  fileName?: string;
}): DetectedSourceKind {
  const mime = normalize(input.mimeType ?? "");
  const fileName = normalize(input.fileName ?? "");

  if (hasAnyExtension(fileName, MIDI_EXTENSIONS) || mime.includes("midi")) {
    return "midi";
  }
  if (hasAnyExtension(fileName, AUDIO_EXTENSIONS) || mime.startsWith("audio/")) {
    return "audio";
  }
  return "unknown";
}

export function detectSourceKindFromAsset(
  asset: Pick<AssetDocument, "kind" | "mimeType" | "originalFilename">,
): DetectedSourceKind {
  if (asset.kind === "midi_source") {
    return "midi";
  }
  if (asset.kind === "audio_source" || asset.kind === "audio_stem" || asset.kind === "audio_preview") {
    return "audio";
  }
  return detectSourceKindFromMimeAndName({
    mimeType: asset.mimeType,
    fileName: asset.originalFilename,
  });
}

export function resolveImportSourceType(input: {
  detectedSourceKind: DetectedSourceKind;
  preferredSourceType?: LevelImportSourceType;
}): LevelImportSourceType {
  if (input.detectedSourceKind === "midi") {
    return "midi";
  }
  if (input.detectedSourceKind === "audio") {
    if (input.preferredSourceType === "full_mix_audio") {
      return "full_mix_audio";
    }
    return "isolated_audio";
  }
  return input.preferredSourceType ?? "midi";
}
