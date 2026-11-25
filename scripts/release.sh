#!/usr/bin/env bash
# Same release as `npm run release`. See scripts/release.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/release.mjs "$@"
