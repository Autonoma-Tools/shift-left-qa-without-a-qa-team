#!/usr/bin/env bash
#
# examples/post-sentry-webhook.sh
#
# Sends a sample Sentry "issue" webhook to the local backfill handler with a
# valid HMAC signature, so you can verify the end-to-end flow (Slack post +
# Autonoma backfill request) without wiring up a real Sentry project.
#
# Usage:
#   SENTRY_WEBHOOK_SECRET=dev-secret ./examples/post-sentry-webhook.sh
#
set -euo pipefail

HANDLER_URL="${HANDLER_URL:-http://localhost:3000/webhooks/sentry}"
SECRET="${SENTRY_WEBHOOK_SECRET:?set SENTRY_WEBHOOK_SECRET to the same value the handler uses}"

# A trimmed but realistic Sentry "issue" webhook body. Level is "fatal" so it
# clears the default "error" threshold.
read -r -d '' BODY <<'JSON' || true
{
  "action": "created",
  "data": {
    "issue": {
      "id": "1234567890",
      "title": "TypeError: Cannot read properties of undefined (reading 'total')",
      "level": "fatal",
      "culprit": "POST /checkout",
      "web_url": "https://sentry.io/organizations/acme/issues/1234567890/",
      "metadata": { "value": "Cannot read properties of undefined" }
    }
  }
}
JSON

# Sentry signs the raw body with HMAC-SHA256 using the client secret.
SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -sS -X POST "$HANDLER_URL" \
  -H "content-type: application/json" \
  -H "sentry-hook-signature: $SIGNATURE" \
  --data-binary "$BODY"

echo
