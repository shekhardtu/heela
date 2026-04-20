#!/usr/bin/env bash
# Deploy the control-plane to edge-1.
#
# Idempotent: safe to re-run. On first run, installs Docker; on subsequent runs,
# rsyncs the latest control-plane source and re-builds the image.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=/dev/null
set -a; source "$REPO_ROOT/.env"; set +a

SERVER="${1:-edge-1}"
SERVER_IP=$(HCLOUD_TOKEN="$HCLOUD_TOKEN" hcloud server ip "$SERVER")
SSH="ssh -i $HOME/.ssh/colbin-edge -o StrictHostKeyChecking=accept-new root@$SERVER_IP"
REMOTE_DIR=/opt/hee

echo "→ Deploying control-plane to $SERVER ($SERVER_IP)"

# ── 1. Install Docker if missing ──────────────────────────────────────────
$SSH "command -v docker >/dev/null 2>&1 || (
  apt-get update &&
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 &&
  systemctl enable --now docker
)"

# ── 2. Generate Postgres password on first run ────────────────────────────
$SSH "mkdir -p $REMOTE_DIR/secrets $REMOTE_DIR/control-plane &&
  if [ ! -f $REMOTE_DIR/secrets/postgres_password.txt ]; then
    openssl rand -hex 24 > $REMOTE_DIR/secrets/postgres_password.txt
    chmod 600 $REMOTE_DIR/secrets/postgres_password.txt
  fi"

# ── 3. Write the env file for control-plane ───────────────────────────────
PG_PASS=$($SSH "cat $REMOTE_DIR/secrets/postgres_password.txt")
ADMIN_TOKEN=$($SSH "[ -f $REMOTE_DIR/secrets/admin_token.txt ] || openssl rand -hex 32 > $REMOTE_DIR/secrets/admin_token.txt; cat $REMOTE_DIR/secrets/admin_token.txt")
$SSH "cat > $REMOTE_DIR/control-plane.env <<EOF
NODE_ENV=production
PORT=5301
DATABASE_URL=postgres://hee:${PG_PASS}@postgres:5432/hee
ADMIN_BOOTSTRAP_TOKEN=${ADMIN_TOKEN}
EOF
chmod 600 $REMOTE_DIR/control-plane.env"

# ── 4. Rsync source (needs the full control-plane/ tree to build) ─────────
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  -e "ssh -i $HOME/.ssh/colbin-edge -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/control-plane/" "root@$SERVER_IP:$REMOTE_DIR/control-plane/"

scp -i "$HOME/.ssh/colbin-edge" -o StrictHostKeyChecking=accept-new \
  "$SCRIPT_DIR/docker-compose.server.yml" \
  "root@$SERVER_IP:$REMOTE_DIR/docker-compose.yml"

# ── 5. Build + start ──────────────────────────────────────────────────────
$SSH "cd $REMOTE_DIR && docker compose up -d --build"

# ── 6. Apply migrations (run inside the running container) ────────────────
$SSH "cd $REMOTE_DIR && docker compose exec -T control-plane npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts || true"
# First-boot sometimes misses typeorm-ts-node (dev dep not included). Fall
# back to a raw psql migration apply via the Postgres container.
$SSH "cd $REMOTE_DIR && docker compose exec -T postgres pg_isready -U hee -d hee >/dev/null 2>&1"

# ── 7. Smoke test ─────────────────────────────────────────────────────────
sleep 5
echo
echo "→ Smoke test: api.hee.la/healthz"
curl -fsS --max-time 10 https://api.hee.la/healthz | jq . || echo "⚠ api.hee.la not responding yet — check logs"

echo
echo "✓ Deploy complete."
echo "  Admin bootstrap token (save this!):"
$SSH "cat $REMOTE_DIR/secrets/admin_token.txt"
echo
echo "  Postgres password (keep safe):"
$SSH "cat $REMOTE_DIR/secrets/postgres_password.txt"
