#!/bin/sh

set -eu

./scripts/prewarm-demucs-model.sh || true

exec npm run dev -- --hostname 0.0.0.0 --port 3000
