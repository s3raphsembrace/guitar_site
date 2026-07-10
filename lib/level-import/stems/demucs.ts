import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdir, readdir, rm } from "node:fs/promises";
import type { StemSeparator, StemSeparationInput, StemSeparationOutput } from "@/lib/level-import/stems/types";
import { isDemucsAvailable } from "@/lib/level-import/runtimeDependencies";

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

function toPublicUrl(absolutePath: string) {
  const publicRoot = path.join(process.cwd(), "public");
  const relative = path.relative(publicRoot, absolutePath).replace(/\\/g, "/");
  return `/${relative}`;
}

const STEM_SEARCH_ORDER: Record<StemSeparationInput["selectedStem"], string[]> = {
  guitar: ["guitar", "other"],
  bass: ["bass"],
  vocals: ["vocals"],
  drums: ["drums"],
  other: ["other"],
};

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"]);
const CHECKPOINT_EXTENSIONS = new Set([".th", ".pt", ".pth", ".ckpt"]);
const DEFAULT_DEMUCS_MODEL = "htdemucs";

interface DemucsRuntimeInfo {
  modelName: string;
  torchHome: string;
  checkpointDirs: string[];
}

interface DemucsCacheSummary {
  checkpointFiles: string[];
  modelMatches: string[];
}

function isHashMismatchError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid hash value") || normalized.includes("hash mismatch");
}

function getSelectedDemucsModel() {
  const configured = process.env.DEMUCS_MODEL?.trim();
  return configured || DEFAULT_DEMUCS_MODEL;
}

function getTorchHomePath() {
  const configured = process.env.TORCH_HOME?.trim();
  if (configured) {
    return configured;
  }
  const home = os.homedir();
  return home ? path.join(home, ".cache", "torch") : path.join(process.cwd(), ".cache", "torch");
}

function getTorchCheckpointCacheDirs(torchHome: string) {
  const dirs = new Set<string>();

  dirs.add(path.join(torchHome, "hub", "checkpoints"));
  dirs.add(path.join(torchHome, "checkpoints"));

  return [...dirs];
}

function getRuntimeInfo(): DemucsRuntimeInfo {
  const modelName = getSelectedDemucsModel();
  const torchHome = getTorchHomePath();
  const checkpointDirs = getTorchCheckpointCacheDirs(torchHome);
  return { modelName, torchHome, checkpointDirs };
}

function toModelToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCheckpointFile(fileName: string) {
  return CHECKPOINT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function inspectTorchCheckpointCache(runtimeInfo: DemucsRuntimeInfo): Promise<DemucsCacheSummary> {
  const checkpointFiles: string[] = [];
  for (const cacheDir of runtimeInfo.checkpointDirs) {
    try {
      const entries = await readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && isCheckpointFile(entry.name)) {
          checkpointFiles.push(path.join(cacheDir, entry.name));
        }
      }
    } catch {
      // Missing cache directories are expected on first run.
    }
  }

  const modelToken = toModelToken(runtimeInfo.modelName);
  const modelMatches = checkpointFiles.filter((filePath) => toModelToken(path.basename(filePath)).includes(modelToken));

  return {
    checkpointFiles,
    modelMatches,
  };
}

function buildRuntimeWarnings(runtimeInfo: DemucsRuntimeInfo, cacheSummary: DemucsCacheSummary) {
  const warnings = [
    `Demucs config: model="${runtimeInfo.modelName}", TORCH_HOME="${runtimeInfo.torchHome}".`,
    `Demucs checkpoint search dirs: ${runtimeInfo.checkpointDirs.join(", ")}.`,
  ];

  if (cacheSummary.checkpointFiles.length === 0) {
    warnings.push("Demucs checkpoint cache is empty; model download may occur if prewarm has not completed.");
    return warnings;
  }

  if (cacheSummary.modelMatches.length > 0) {
    warnings.push(
      `Demucs cache has ${cacheSummary.modelMatches.length} checkpoint file(s) matching model "${runtimeInfo.modelName}".`,
    );
    return warnings;
  }

  warnings.push(
    `Demucs cache has ${cacheSummary.checkpointFiles.length} checkpoint file(s), but none matched "${runtimeInfo.modelName}" by filename.`,
  );
  return warnings;
}

async function clearTorchCheckpointCache(runtimeInfo: DemucsRuntimeInfo) {
  const cacheDirs = runtimeInfo.checkpointDirs;
  await Promise.all(cacheDirs.map((cacheDir) => rm(cacheDir, { recursive: true, force: true })));
}

function getDemucsRunArgs(input: StemSeparationInput, outputRoot: string, modelName: string) {
  return ["--mp3", "--name", modelName, "--out", outputRoot, input.sourceAudioAbsolutePath];
}

async function runDemucsWithRetry(input: StemSeparationInput, outputRoot: string, runtimeInfo: DemucsRuntimeInfo) {
  const args = getDemucsRunArgs(input, outputRoot, runtimeInfo.modelName);
  const warnings: string[] = [];

  try {
    await runCommand("demucs", args);
    return warnings;
  } catch (error) {
    const firstErrorMessage = error instanceof Error ? error.message : "Unknown demucs error";
    if (!isHashMismatchError(firstErrorMessage)) {
      throw error;
    }

    try {
      await clearTorchCheckpointCache(runtimeInfo);
      warnings.push(
        `Demucs model cache was reset at ${runtimeInfo.checkpointDirs.join(", ")} after a hash mismatch, then retried once.`,
      );
    } catch {
      warnings.push("Demucs model hash mismatch detected; cache cleanup failed before retry.");
    }

    try {
      await runCommand("demucs", args);
      return warnings;
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : "Unknown demucs retry error";
      const retryContext = warnings.length > 0 ? ` ${warnings.join(" ")}` : "";
      throw new Error(
        `Demucs model download failed after one retry (${retryMessage}).${retryContext}`,
      );
    }
  }
}

function normalizePathForSearch(value: string) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function stemNameFromFile(filePath: string) {
  return path.parse(filePath).name.toLowerCase();
}

function isAudioStemFile(filePath: string) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function compareStemFilePreference(a: string, b: string) {
  const extA = path.extname(a).toLowerCase();
  const extB = path.extname(b).toLowerCase();
  if (extA !== extB) {
    if (extA === ".mp3") {
      return -1;
    }
    if (extB === ".mp3") {
      return 1;
    }
  }
  return a.localeCompare(b);
}

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(absolutePath);
      }
      return [absolutePath];
    }),
  );
  return nested.flat();
}

function resolveSourceScopedFiles(allStemFiles: string[], sourceAudioAbsolutePath: string) {
  const sourceBaseName = path.parse(sourceAudioAbsolutePath).name.toLowerCase();
  const marker = `/${sourceBaseName}/`;
  const scoped = allStemFiles.filter((file) => normalizePathForSearch(file).includes(marker));
  return scoped.length > 0 ? scoped : allStemFiles;
}

function resolveSelectedStemPath(
  stemFiles: string[],
  selectedStem: StemSeparationInput["selectedStem"],
): { stemAbsolutePath: string; resolvedStem: string } | null {
  const preferredStemNames = STEM_SEARCH_ORDER[selectedStem];

  for (const preferredStem of preferredStemNames) {
    const matches = stemFiles
      .filter((file) => stemNameFromFile(file) === preferredStem)
      .sort(compareStemFilePreference);

    if (matches.length > 0) {
      return {
        stemAbsolutePath: matches[0],
        resolvedStem: preferredStem,
      };
    }
  }

  return null;
}

class DemucsStemSeparator implements StemSeparator {
  name = "demucs";

  async separate(input: StemSeparationInput): Promise<StemSeparationOutput> {
    const runtimeInfo = getRuntimeInfo();
    const cacheSummary = await inspectTorchCheckpointCache(runtimeInfo);
    const runtimeWarnings = buildRuntimeWarnings(runtimeInfo, cacheSummary);

    const outputRoot = path.join(path.dirname(input.sourceAudioAbsolutePath), "stems");
    await mkdir(outputRoot, { recursive: true });

    if (!isDemucsAvailable({ forceRefresh: true })) {
      return {
        stemAbsolutePath: input.sourceAudioAbsolutePath,
        stemPublicUrl: toPublicUrl(input.sourceAudioAbsolutePath),
        warnings: [
          ...runtimeWarnings,
          "Demucs is not installed on the server runtime. Continuing with original audio.",
        ],
      };
    }

    let runWarnings: string[] = [];
    try {
      runWarnings = await runDemucsWithRetry(input, outputRoot, runtimeInfo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown demucs error";
      return {
        stemAbsolutePath: input.sourceAudioAbsolutePath,
        stemPublicUrl: toPublicUrl(input.sourceAudioAbsolutePath),
        warnings: [
          ...runtimeWarnings,
          ...runWarnings,
          `Demucs separation unavailable (${message}). Continuing with original audio.`,
        ],
      };
    }

    let stemFiles: string[] = [];
    try {
      const allFiles = await listFilesRecursively(outputRoot);
      const audioFiles = allFiles.filter(isAudioStemFile);
      stemFiles = resolveSourceScopedFiles(audioFiles, input.sourceAudioAbsolutePath);
    } catch {
      stemFiles = [];
    }

    const selected = resolveSelectedStemPath(stemFiles, input.selectedStem);
    if (!selected) {
      const availableStemNames = [...new Set(stemFiles.map(stemNameFromFile))].sort().join(", ");
      return {
        stemAbsolutePath: input.sourceAudioAbsolutePath,
        stemPublicUrl: toPublicUrl(input.sourceAudioAbsolutePath),
        warnings: [
          ...runtimeWarnings,
          ...runWarnings,
          availableStemNames
            ? `Demucs finished, but requested stem "${input.selectedStem}" was not found (available: ${availableStemNames}). Continuing with original audio.`
            : `Demucs finished, but no stem files were discovered for "${input.selectedStem}". Continuing with original audio.`,
        ],
      };
    }

    const selectionWarnings = [...runtimeWarnings, ...runWarnings];
    if (selected.resolvedStem !== input.selectedStem) {
      selectionWarnings.push(
        `Requested "${input.selectedStem}" stem is not directly produced by Demucs. Using "${selected.resolvedStem}" stem instead.`,
      );
    }
    selectionWarnings.push(`Using Demucs "${selected.resolvedStem}" stem for transcription.`);

    return {
      stemAbsolutePath: selected.stemAbsolutePath,
      stemPublicUrl: toPublicUrl(selected.stemAbsolutePath),
      warnings: selectionWarnings,
    };
  }
}

let singleton: StemSeparator | null = null;

export function getStemSeparator() {
  if (singleton) {
    return singleton;
  }
  singleton = new DemucsStemSeparator();
  return singleton;
}
