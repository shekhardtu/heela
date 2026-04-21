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
JWT_SECRET=$($SSH "[ -f $REMOTE_DIR/secrets/auth_jwt_secret.txt ] || openssl rand -hex 48 > $REMOTE_DIR/secrets/auth_jwt_secret.txt; cat $REMOTE_DIR/secrets/auth_jwt_secret.txt")
# Postmark token — provided via $POSTMARK_SERVER_TOKEN env (local); written to
# secrets file on edge-1 so re-runs don't lose it.
if [ -n "${POSTMARK_SERVER_TOKEN:-}" ]; then
  $SSH "echo '$POSTMARK_SERVER_TOKEN' > $REMOTE_DIR/secrets/postmark_token.txt && chmod 600 $REMOTE_DIR/secrets/postmark_token.txt"
fi
POSTMARK_TOKEN=$($SSH "[ -f $REMOTE_DIR/secrets/postmark_token.txt ] && cat $REMOTE_DIR/secrets/postmark_token.txt || true")

$SSH "cat > $REMOTE_DIR/control-plane.env <<EOF
NODE_ENV=production
PORT=5301
DATABASE_URL=postgres://hee:${PG_PASS}@postgres:5432/hee
ADMIN_BOOTSTRAP_TOKEN=${ADMIN_TOKEN}
AUTH_JWT_SECRET=${JWT_SECRET}
PORTAL_BASE_URL=https://app.hee.la
POSTMARK_SERVER_TOKEN=${POSTMARK_TOKEN}
POSTMARK_FROM_ADDRESS=Hee <auth@hee.la>
POSTMARK_STREAM_ID=outbound
# Caddy admin is bound to the docker bridge gateway (see Caddyfile) so
# the control-plane container can reach it. Matching Origin allow-list
# lives in /etc/caddy/Caddyfile under the admin block.
CADDY_ADMIN_URL=http://172.17.0.1:2019
EOF
chmod 600 $REMOTE_DIR/control-plane.env"

# ── 4. Rsync source (needs the full control-plane/ + portal/ trees) ──────
rsync -az --delete \
  --exclude node_modules --exclude dist \
  -e "ssh -i $HOME/.ssh/colbin-edge -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/control-plane/" "root@$SERVER_IP:$REMOTE_DIR/control-plane/"

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude dist \
  -e "ssh -i $HOME/.ssh/colbin-edge -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/portal/" "root@$SERVER_IP:$REMOTE_DIR/portal/"

# ── 4b. Build + rsync the static sites (marketing, docs) ──────────────────
# Caddy serves /opt/hee/{marketing,docs-site}/dist directly — no container.
for site in marketing docs-site; do
  if [ -d "$REPO_ROOT/$site" ]; then
    echo "→ Building $site"
    (cd "$REPO_ROOT/$site" && \
      if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi && \
      npm run build)
    $SSH "mkdir -p $REMOTE_DIR/$site"
    rsync -az --delete \
      -e "ssh -i $HOME/.ssh/colbin-edge -o StrictHostKeyChecking=accept-new" \
      "$REPO_ROOT/$site/dist/" "root@$SERVER_IP:$REMOTE_DIR/$site/dist/"
  fi
done

scp -i "$HOME/.ssh/colbin-edge" -o StrictHostKeyChecking=accept-new \
  "$SCRIPT_DIR/docker-compose.server.yml" \
  "root@$SERVER_IP:$REMOTE_DIR/docker-compose.yml"

# ── 4c. Update Caddyfile on the host + reload ────────────────────────────
scp -i "$HOME/.ssh/colbin-edge" -o StrictHostKeyChecking=accept-new \
  "$REPO_ROOT/infra/caddy/Caddyfile" \
  "root@$SERVER_IP:/etc/caddy/Caddyfile"
$SSH "caddy fmt --overwrite /etc/caddy/Caddyfile && systemctl reload caddy"

# ── 5. Build + start ──────────────────────────────────────────────────────
$SSH "cd $REMOTE_DIR && docker compose up -d --build"

# ── 6. Apply migrations (compiled JS — no ts-node required) ───────────────
# First, seed TypeORM's `migrations` table so it knows existing schema is up
# to date (we applied the original migrations via psql before wiring this up).
# Subsequent deploys just run pending migrations normally.
$SSH "cd $REMOTE_DIR && docker compose exec -T postgres psql -U hee -d hee <<'SQL'
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR NOT NULL
);
INSERT INTO migrations (timestamp, name)
SELECT v.timestamp, v.name FROM (VALUES
  (1776720000000::bigint, 'Initial1776720000000'),
  (1776730000000::bigint, 'AddAuth1776730000000'),
  (1776740000000::bigint, 'AddInvitations1776740000000')
) AS v(timestamp, name)
WHERE NOT EXISTS (SELECT 1 FROM migrations m WHERE m.name = v.name);

-- New migrations (AddProjectErrorPage, AddAuditEvents) will be run fresh by
-- db:migrate:prod — nothing to seed for them.
SQL"

$SSH "cd $REMOTE_DIR && docker compose exec -T control-plane npm run db:migrate:prod"

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
