#!/usr/bin/env bash
# =============================================================================
# Console de facturation — seed AWS SSM /billing-frontend/prod/* (HORS BOX, admin).
#
# Cette configuration est PUBLIQUE : elle est servie au navigateur dans
# index.html. Donc String uniquement, jamais SecureString — un secret n'aurait
# rien à faire ici.
# =============================================================================
set -euo pipefail
REGION="eu-west-1"
P="/billing-frontend/prod"

put() { aws ssm put-parameter --region "$REGION" --name "$P/$1" --type String --overwrite --value "$2" >/dev/null && echo "  ok $1"; }

put API_BASE_URL "https://billing-api.foxugly.com"
put SENTRY_DSN   "<DSN du projet billing-frontend>"
put SENTRY_ENV   "production"
