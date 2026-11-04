#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../../../scripts/release-lib.sh"

COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-chore: prepare release}"

ensure_git_on_main

npm run test

# Synchroniser js/core et index.html (et regenerer app/, non versionne) avant de committer
npm run sync:app

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$COMMIT_MESSAGE"
fi

if ! release_needed "excel-v" "apps/excel" "packages/atelier-core"; then
  echo "[release:all] Aucun changement a publier pour Excel."
  exit 0
fi

npm run release
git push --follow-tags

echo "[release:all] Publication terminee."
