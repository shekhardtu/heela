#!/usr/bin/env bash
# Provisions edge-1 on Hetzner Cloud (CX23 @ Falkenstein).
# Idempotent: safe to re-run — will skip if server already exists.
#
# Preconditions:
#   - .env file (in repo root) sets HCLOUD_TOKEN
#   - hcloud CLI installed (`brew install hcloud`)
#   - `hari-mac` SSH key already registered in the project
#
# Usage: ./infra/hcloud/provision.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=/dev/null
set -a; source "$REPO_ROOT/.env"; set +a

SERVER_NAME="${1:-edge-1}"
TYPE="${HCLOUD_SERVER_TYPE:-cx23}"
LOCATION="${HCLOUD_LOCATION:-fsn1}"
IMAGE="${HCLOUD_IMAGE:-ubuntu-24.04}"
SSH_KEY="${HCLOUD_SSH_KEY:-hari-mac}"
CLOUD_INIT="$REPO_ROOT/infra/cloud-init/edge-1.yml"

if [ ! -f "$CLOUD_INIT" ]; then
  echo "✗ cloud-init file missing: $CLOUD_INIT"
  exit 1
fi

echo "→ Checking if $SERVER_NAME already exists..."
if hcloud server describe "$SERVER_NAME" >/dev/null 2>&1; then
  echo "✓ $SERVER_NAME already exists — skipping create"
  hcloud server describe "$SERVER_NAME" -o json | jq '{name, server_type: .server_type.name, status, public_net: {ipv4: .public_net.ipv4.ip}}'
  exit 0
fi

echo "→ Creating $SERVER_NAME ($TYPE @ $LOCATION, $IMAGE, ssh-key=$SSH_KEY)..."
hcloud server create \
  --name "$SERVER_NAME" \
  --type "$TYPE" \
  --location "$LOCATION" \
  --image "$IMAGE" \
  --ssh-key "$SSH_KEY" \
  --user-data-from-file "$CLOUD_INIT"

echo
echo "✓ Server created. Fetching details..."
hcloud server describe "$SERVER_NAME" -o json | jq '{name, server_type: .server_type.name, status, ipv4: .public_net.ipv4.ip, ipv6: .public_net.ipv6.ip}'

echo
echo "→ Waiting ~90s for cloud-init + Caddy install..."
IP=$(hcloud server ip "$SERVER_NAME")
for i in {1..30}; do
  if curl -fsS --max-time 3 "http://${IP}/_healthz" 2>/dev/null | grep -q "ok"; then
    echo "✓ edge-1 responding on http://${IP}/_healthz"
    break
  fi
  sleep 5
  echo "  … still booting ($((i*5))s)"
done

echo
echo "Next: add DNS A-record   edge.colbin.com  →  $IP   (grey-cloud / DNS-only)"
echo "SSH:                     ssh -i ~/.ssh/colbin-edge root@$IP"
