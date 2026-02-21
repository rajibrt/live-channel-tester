#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./deploy.sh <firebase-project-id>"
  exit 1
fi

PROJECT_ID="$1"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR/functions"
npm install
cd "$ROOT_DIR"

firebase use "$PROJECT_ID"
firebase deploy

echo "Deploy completed for project: $PROJECT_ID"
