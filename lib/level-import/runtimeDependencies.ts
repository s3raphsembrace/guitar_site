import { spawnSync } from "node:child_process";

const CACHE_TTL_MS = 10_000;

export type BasicPitchAvailability = "cli" | "python_module" | "missing";

export interface RuntimeDependencyStatus {
  demucs: boolean;
  basicPitch: BasicPitchAvailability;
}

let cached:
  | {
      expiresAt: number;
      status: RuntimeDependencyStatus;
    }
  | null = null;

function hasCommand(command: string) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function hasPythonModule(moduleName: string) {
  const pythonCandidates = process.platform === "win32"
    ? ["py", "python", "python3"]
    : ["python3", "python"];

  for (const pythonCommand of pythonCandidates) {
    const result = spawnSync(pythonCommand, ["-c", `import ${moduleName}`], {
      stdio: "ignore",
    });
    if (!result.error && result.status === 0) {
      return true;
    }
  }

  return false;
}

function resolveBasicPitchAvailability(): BasicPitchAvailability {
  if (hasCommand("basic-pitch")) {
    return "cli";
  }
  if (hasPythonModule("basic_pitch")) {
    return "python_module";
  }
  return "missing";
}

export function getRuntimeDependencyStatus(
  options?: { forceRefresh?: boolean },
): RuntimeDependencyStatus {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.status;
  }

  const status: RuntimeDependencyStatus = {
    demucs: hasCommand("demucs"),
    basicPitch: resolveBasicPitchAvailability(),
  };

  cached = {
    expiresAt: now + CACHE_TTL_MS,
    status,
  };

  return status;
}

export function isDemucsAvailable(options?: { forceRefresh?: boolean }) {
  return getRuntimeDependencyStatus(options).demucs;
}

export function isBasicPitchAvailable(options?: { forceRefresh?: boolean }) {
  return getRuntimeDependencyStatus(options).basicPitch !== "missing";
}
