#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/home-management"
APPSTORE_DIR="${ROOT_DIR}/home-management-appstore"

WITH_INSTALL=0
WITH_IOS_SYNC=0

for arg in "$@"; do
  case "$arg" in
    --install)
      WITH_INSTALL=1
      ;;
    --ios-sync)
      WITH_IOS_SYNC=1
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $(basename "$0") [--install] [--ios-sync]"
      exit 1
      ;;
  esac
done

if [[ ! -d "$WEB_DIR" || ! -d "$APPSTORE_DIR" ]]; then
  echo "Missing project directories."
  echo "Expected:"
  echo "  - $WEB_DIR"
  echo "  - $APPSTORE_DIR"
  exit 1
fi

echo "Syncing shared web files from home-management -> home-management-appstore..."

sync_dir() {
  local rel="$1"
  local src="${WEB_DIR}/${rel}/"
  local dst="${APPSTORE_DIR}/${rel}/"
  if [[ -d "$src" ]]; then
    mkdir -p "$dst"
    rsync -a --delete "$src" "$dst"
    echo "  synced dir: $rel"
  else
    rm -rf "${APPSTORE_DIR:?}/${rel}"
    echo "  removed missing dir: $rel"
  fi
}

sync_file() {
  local rel="$1"
  local src="${WEB_DIR}/${rel}"
  local dst="${APPSTORE_DIR}/${rel}"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    echo "  synced file: $rel"
  else
    rm -f "$dst"
    echo "  removed missing file: $rel"
  fi
}

sync_dir "src"
sync_dir "public"
sync_dir "supabase"

sync_file "next.config.ts"
sync_file "postcss.config.mjs"
sync_file "tailwind.config.ts"
sync_file "tsconfig.json"
sync_file ".env.example"
sync_file "README.md"

echo "Merging package.json (keep iOS scripts in appstore project)..."
WEB_PACKAGE="$WEB_DIR/package.json" APPSTORE_PACKAGE="$APPSTORE_DIR/package.json" node <<'NODE'
const fs = require("fs");

const webPath = process.env.WEB_PACKAGE;
const appPath = process.env.APPSTORE_PACKAGE;

const web = JSON.parse(fs.readFileSync(webPath, "utf8"));
const app = JSON.parse(fs.readFileSync(appPath, "utf8"));

const appStoreScripts = {
  "build:ios": app.scripts?.["build:ios"] || "npm run build && npx cap sync ios",
  "ios:sync": app.scripts?.["ios:sync"] || "npx cap sync ios",
  "ios:open": app.scripts?.["ios:open"] || "npx cap open ios",
};

const merged = {
  ...app,
  name: web.name,
  version: web.version,
  private: web.private,
  scripts: {
    ...web.scripts,
    ...appStoreScripts,
  },
  dependencies: web.dependencies,
  devDependencies: web.devDependencies,
};

fs.writeFileSync(appPath, `${JSON.stringify(merged, null, 2)}\n`);
NODE

echo "Sync completed."

if [[ "$WITH_INSTALL" -eq 1 ]]; then
  echo "Running npm install in appstore project..."
  (cd "$APPSTORE_DIR" && npm install)
fi

if [[ "$WITH_IOS_SYNC" -eq 1 ]]; then
  echo "Running iOS sync..."
  (cd "$APPSTORE_DIR" && npm run ios:sync)
fi

echo "Done."
