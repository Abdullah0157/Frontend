#!/usr/bin/env bash
# Deploy the frontend to production AND promote the jobstream-ai-app alias.
#
# `vercel deploy --prod` on this project creates a new deployment but does NOT
# move the jobstream-ai-app.vercel.app alias to it (the alias is manual, not the
# project's auto production domain). This script does both, so a deploy is always
# actually live. Usage:  ./scripts/deploy-prod.sh
set -euo pipefail

ALIAS="jobstream-ai-app.vercel.app"

echo "▶ deploying to production…"
OUT="$(vercel deploy --prod --yes 2>&1)"
# The deployment URL is the vercel.app URL that isn't the vercel.com inspect link.
NEW="$(printf '%s\n' "$OUT" | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | grep -v 'vercel\.com' | head -1)"
if [ -z "$NEW" ]; then
  # Fallback: newest production deployment.
  NEW="$(vercel ls "$ALIAS" --prod 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | head -1)"
fi
[ -n "$NEW" ] || { echo "✗ could not determine the new deployment URL"; echo "$OUT"; exit 1; }

echo "▶ aliasing $ALIAS → $NEW"
vercel alias set "$NEW" "$ALIAS" >/dev/null

echo "✓ live at https://$ALIAS  (deployment: $NEW)"
