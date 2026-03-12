#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/home-management"
APPSTORE_DIR="${ROOT_DIR}/home-management-appstore"

echo "Verifying web project..."
(cd "$WEB_DIR" && npm run lint && npm run build)

echo "Verifying appstore project..."
(cd "$APPSTORE_DIR" && npm run lint && npm run build)

echo "All checks passed."
