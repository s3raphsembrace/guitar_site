#!/bin/sh

set -eu

DEMUCS_MODEL="${DEMUCS_MODEL:-htdemucs}"
TORCH_HOME="${TORCH_HOME:-/opt/torch-cache}"
PREWARM_DEMUCS_MODEL="${PREWARM_DEMUCS_MODEL:-1}"

export TORCH_HOME

echo "[audio-import] Demucs model: ${DEMUCS_MODEL}"
echo "[audio-import] TORCH_HOME: ${TORCH_HOME}"
mkdir -p "${TORCH_HOME}"

checkpoint_count="$(
  find "${TORCH_HOME}/hub/checkpoints" "${TORCH_HOME}/checkpoints" -maxdepth 1 -type f \
    \( -name "*.th" -o -name "*.pt" -o -name "*.pth" -o -name "*.ckpt" \) 2>/dev/null \
    | wc -l | tr -d " " || true
)"
if [ "${checkpoint_count}" != "" ] && [ "${checkpoint_count}" -gt 0 ]; then
  echo "[audio-import] Existing Demucs checkpoints detected (${checkpoint_count}). Skipping prewarm download."
  exit 0
fi

if [ "${PREWARM_DEMUCS_MODEL}" = "0" ] || [ "${PREWARM_DEMUCS_MODEL}" = "false" ]; then
  echo "[audio-import] Demucs prewarm disabled (PREWARM_DEMUCS_MODEL=${PREWARM_DEMUCS_MODEL})."
  exit 0
fi

if ! command -v demucs >/dev/null 2>&1; then
  echo "[audio-import] Demucs CLI is unavailable, skipping model prewarm."
  exit 0
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[audio-import] ffmpeg is unavailable, skipping Demucs model prewarm."
  exit 0
fi

tmpdir="$(mktemp -d)"
input_wav="${tmpdir}/prewarm.wav"
output_dir="${tmpdir}/out"
log_file="${tmpdir}/demucs-prewarm.log"

cleanup() {
  rm -rf "${tmpdir}"
}
trap cleanup EXIT

if ! ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.7 -acodec pcm_s16le "${input_wav}" -y -loglevel error >/dev/null 2>&1; then
  echo "[audio-import] WARNING: Failed to generate prewarm sample; skipping Demucs prewarm."
  exit 0
fi

if demucs --mp3 --name "${DEMUCS_MODEL}" --out "${output_dir}" "${input_wav}" >"${log_file}" 2>&1; then
  echo "[audio-import] Demucs model prewarm completed for model ${DEMUCS_MODEL}."
  exit 0
fi

echo "[audio-import] WARNING: Demucs model prewarm failed. Imports will continue to use fallback behavior."
head -n 3 "${log_file}" || true
