#!/bin/bash
# Self update script for api.norb.space

set -eo pipefail

SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR"
git pull origin main
pnpm install --frozen-lockfile
pm2 reload api-server

echo "API Server updated successfully!"