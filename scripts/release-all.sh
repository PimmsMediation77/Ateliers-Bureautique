#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/release-lib.sh"

COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-chore: prepare monorepo release}"

ensure_git_on_main

npm run word:test
npm run excel:test
npm run powerpoint:test

npm run word:build:data
npm run excel:build:data
npm run powerpoint:build:data

npm run word:sync:app
npm run excel:sync:app
npm run powerpoint:sync:app

npm run word:validate:app-sync
npm run excel:validate:app-sync
npm run powerpoint:validate:app-sync

npm run assets:check-links

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$COMMIT_MESSAGE"
fi

word_release_needed=false
excel_release_needed=false
powerpoint_release_needed=false
global_release_needed=false

if release_needed "word-v" "apps/word" "packages/atelier-core"; then
  word_release_needed=true
fi

if release_needed "excel-v" "apps/excel" "packages/atelier-core"; then
  excel_release_needed=true
fi

if release_needed "powerpoint-v" "apps/powerpoint" "packages/atelier-core"; then
  powerpoint_release_needed=true
fi

if release_needed "bureautique-v" "apps" "packages" "pages" "scripts" "package.json" "README.md"; then
  global_release_needed=true
fi

if [[ "$word_release_needed" == true ]]; then
  npm run word:release
else
  echo "[release:all] Aucun changement a publier pour Word."
fi

if [[ "$excel_release_needed" == true ]]; then
  npm run excel:release
else
  echo "[release:all] Aucun changement a publier pour Excel."
fi

if [[ "$powerpoint_release_needed" == true ]]; then
  npm run powerpoint:release
else
  echo "[release:all] Aucun changement a publier pour PowerPoint."
fi

if [[ "$global_release_needed" == true ]]; then
  node scripts/release-global.mjs
else
  echo "[release:all] Aucun changement a publier pour la version globale."
fi

if [[ "$word_release_needed" == false && "$excel_release_needed" == false && "$powerpoint_release_needed" == false && "$global_release_needed" == false ]]; then
  echo "[release:all] Aucun bump de version necessaire."
  exit 0
fi

git push --follow-tags

echo "[release:all] Publication monorepo terminee."
