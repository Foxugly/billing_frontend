#!/usr/bin/env bash
# =============================================================================
# Console de facturation — récupère la configuration d'exécution depuis AWS SSM
# et l'écrit dans un snippet nginx (`set $billing_* …`) que le vhost inclut et
# injecte dans index.html.
#
# Lancé par billing-frontend-runtime-fetch.service (oneshot) au boot et au
# déploiement. Lit /billing-frontend/prod/* (eu-west-1) via le rôle d'instance
# EC2. Cette configuration est PUBLIQUE (servie au navigateur) → SSM String
# uniquement, jamais un secret.
#
# §3.10 : tourne en root, donc installé dans /usr/local/sbin depuis le blob git
# committé — jamais exécuté depuis l'arbre écrivable par django.
# =============================================================================
set -euo pipefail

SSM_PREFIX="${BILLING_FRONTEND_SSM_PREFIX:-/billing-frontend/prod}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
OUT_FILE="${BILLING_FRONTEND_RUNTIME_FILE:-/etc/nginx/snippets/billing-frontend-runtime.conf}"

echo "[frontend-runtime] prefix=$SSM_PREFIX region=$AWS_REGION out=$OUT_FILE"

RAW_FILE="$(mktemp)"
TMP_FILE="$(mktemp)"
trap 'rm -f "$RAW_FILE" "$TMP_FILE"' EXIT

aws ssm get-parameters-by-path \
    --path "$SSM_PREFIX" \
    --recursive \
    --region "$AWS_REGION" \
    --output json > "$RAW_FILE"

python3 - "$SSM_PREFIX" "$TMP_FILE" "$RAW_FILE" <<'PY'
import json, sys

prefix, out_path, raw_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(raw_path) as fh:
    params = json.load(fh).get("Parameters", [])

values = {
    "API_BASE_URL": "",
    "SENTRY_DSN": "",
    "SENTRY_ENV": "production",
}
for p in params:
    key = p["Name"][len(prefix):].lstrip("/")
    value = p["Value"].strip("\r\n")
    # Une valeur multi-ligne casserait la directive nginx en silence.
    if "\n" in value or "\r" in value:
        sys.stderr.write(f"ERROR: value for {key} contains an internal newline; refusing.\n")
        sys.exit(1)
    # Un guillemet fermerait la chaîne nginx et ouvrirait une injection de directive.
    if '"' in value:
        sys.stderr.write(f"ERROR: value for {key} contains a double quote; refusing.\n")
        sys.exit(1)
    if key in values:
        values[key] = value

report = ""
dsn = values["SENTRY_DSN"]
if dsn.startswith("https://") and "@" in dsn and "/" in dsn.split("@", 1)[1]:
    host, project = dsn.split("@", 1)[1].split("/", 1)
    key = dsn.split("//", 1)[1].split("@", 1)[0]
    report = f"; report-uri https://{host}/api/{project}/security/?sentry_key={key}"

with open(out_path, "w") as fh:
    fh.write(f'set $billing_api_base   "{values["API_BASE_URL"]}";\n')
    fh.write(f'set $billing_sentry_dsn "{dsn}";\n')
    fh.write(f'set $billing_sentry_env "{values["SENTRY_ENV"]}";\n')
    fh.write(f'set $billing_csp_report "{report}";\n')
PY

install -o root -g root -m 0644 "$TMP_FILE" "$OUT_FILE"
echo "[frontend-runtime] wrote $OUT_FILE"

# Ne recharger que si la configuration est valide : un snippet fautif ne doit
# jamais emporter nginx, donc les autres sites de la flotte avec lui.
if nginx -t; then
    systemctl reload nginx
else
    echo "ERROR: nginx -t a échoué, rechargement annulé." >&2
    exit 1
fi
