import { spawnSync } from "node:child_process";

const REQUIRED_AUDIO_COMMANDS = ["ffmpeg", "ffprobe"] as const;
const CACHE_TTL_MS = 10_000;

export interface AudioImportCapability {
  available: boolean;
  environment: "development" | "production";
  message: string;
  missingCommands: string[];
}

let cached:
  | {
      expiresAt: number;
      capability: AudioImportCapability;
    }
  | null = null;

function hasCommand(command: string) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return result.status === 0;
}

function getEnvironment(): "development" | "production" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function buildUnavailableMessage(environment: "development" | "production", missing: string[]) {
  const dependencyLabel = missing.join(", ");
  if (environment === "production") {
    return `Audio import is temporarily unavailable due to a production server configuration issue (${dependencyLabel} missing).`;
  }
  return `Audio import is temporarily unavailable in this local development environment (${dependencyLabel} missing on the server runtime).`;
}

export function getAudioImportCapability(options?: { forceRefresh?: boolean }): AudioImportCapability {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.capability;
  }

  const environment = getEnvironment();
  const missingCommands = REQUIRED_AUDIO_COMMANDS.filter((command) => !hasCommand(command));
  const available = missingCommands.length === 0;
  const capability: AudioImportCapability = {
    available,
    environment,
    message: available
      ? "Audio import is available."
      : buildUnavailableMessage(environment, missingCommands),
    missingCommands,
  };

  cached = {
    expiresAt: now + CACHE_TTL_MS,
    capability,
  };

  return capability;
}

export class AudioImportUnavailableError extends Error {
  code = "AUDIO_IMPORT_UNAVAILABLE";
  status = 503;
  capability: AudioImportCapability;

  constructor(capability: AudioImportCapability) {
    super(capability.message);
    this.name = "AudioImportUnavailableError";
    this.capability = capability;
  }
}
