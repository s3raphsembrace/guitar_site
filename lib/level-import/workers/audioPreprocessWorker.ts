import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { AssetMetadata } from "@/types/level-import";
import { getAudioImportCapability } from "@/lib/level-import/capabilities";

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

function buildWavOutputPath(inputAbsolutePath: string) {
  const dir = path.dirname(inputAbsolutePath);
  const outputDir = path.join(dir, "processed");
  const outputFile = `${path.parse(inputAbsolutePath).name}_${randomUUID().slice(0, 8)}.wav`;
  return path.join(outputDir, outputFile);
}

function toPublicUrl(absolutePath: string) {
  const publicRoot = path.join(process.cwd(), "public");
  const relative = path.relative(publicRoot, absolutePath).replace(/\\/g, "/");
  return `/${relative}`;
}

export interface AudioPreprocessInput {
  inputAbsolutePath: string;
}

export interface AudioPreprocessOutput {
  wavAbsolutePath: string;
  wavPublicUrl: string;
  metadata: AssetMetadata;
  warnings: string[];
}

export async function runAudioPreprocessWorker(
  input: AudioPreprocessInput,
): Promise<AudioPreprocessOutput> {
  const warnings: string[] = [];
  const wavAbsolutePath = buildWavOutputPath(input.inputAbsolutePath);
  await mkdir(path.dirname(wavAbsolutePath), { recursive: true });

  try {
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      input.inputAbsolutePath,
      "-ac",
      "1",
      "-ar",
      "44100",
      "-vn",
      wavAbsolutePath,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ffmpeg error";
    const capability = getAudioImportCapability({ forceRefresh: true });
    const baseMessage = capability.available
      ? "Audio preprocessing failed in the server media pipeline."
      : capability.message;
    throw new Error(
      `${baseMessage} Technical details: ${message}`,
    );
  }

  let metadata: AssetMetadata = {};
  try {
    const probe = await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=sample_rate,channels",
      "-of",
      "json",
      wavAbsolutePath,
    ]);

    const parsed = JSON.parse(probe.stdout) as {
      streams?: Array<{ sample_rate?: string; channels?: number }>;
      format?: { duration?: string };
    };
    const stream = parsed.streams?.[0];
    metadata = {
      durationSec: parsed.format?.duration ? Number(parsed.format.duration) : undefined,
      sampleRateHz: stream?.sample_rate ? Number(stream.sample_rate) : undefined,
      channels: stream?.channels,
    };
  } catch {
    warnings.push("Audio metadata extraction failed. Continuing with default metadata.");
  }

  return {
    wavAbsolutePath,
    wavPublicUrl: toPublicUrl(wavAbsolutePath),
    metadata,
    warnings,
  };
}
