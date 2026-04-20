#!/usr/bin/env bash
# End-to-end test of the local edge stack.
#
# Assumes `docker compose -f docker-compose.dev.yml up` is running.
# Validates:
#   1. Caddy health endpoint responds
#   2. Allowlisted hostname is proxied to upstream (cert issued via Caddy's
#      internal CA, so we pass --insecure — that's fine for local)
#   3. Non-allowlisted hostname is rejected (Caddy refuses to issue cert,
#      TLS handshake fails)
#   4. Control-plane mock is reachable

set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

pass() { echo "${GREEN}✓${NC} $1"; }
fail() { echo "${RED}✗${NC} $1"; exit 1; }
info() { echo "${YELLOW}→${NC} $1"; }

info "Checking caddy health on :80 (plain HTTP bypass)"
if curl -fsS -H "Host: any.host.test" http://localhost/_healthz | grep -q "ok"; then
  pass "caddy :80/_healthz ok"
else
  fail "caddy :80/_healthz did not respond"
fi

info "Checking control-plane mock directly"
if curl -fsS http://localhost:5301/_list | grep -q "engineering.loopai.com"; then
  pass "control-plane allowlist reachable"
else
  fail "control-plane unreachable on :5301"
fi

info "Allowlisted hostname should get a cert + proxy to upstream"
RESP=$(curl -sk --resolve engineering.loopai.com:443:127.0.0.1 \
  https://engineering.loopai.com/)
if echo "$RESP" | grep -q "upstream reached"; then
  pass "engineering.loopai.com → upstream"
else
  fail "engineering.loopai.com did not reach upstream. Got: $RESP"
fi

info "Non-allowlisted hostname should be refused"
# Caddy returns an error response (TLS issuance denied by ask hook).
set +e
RESP2=$(curl -sk --resolve unclaimed.example.test:443:127.0.0.1 \
  -o /dev/null -w "%{http_code}" https://unclaimed.example.test/ 2>/dev/null)
EXIT=$?
set -e
# Either curl fails (TLS error → non-zero exit) OR Caddy responds with an
# error status. Both are acceptable; the key is the upstream never reached.
if [ "$EXIT" -ne 0 ] || [ "$RESP2" = "421" ] || [ "$RESP2" = "502" ]; then
  pass "unclaimed.example.test refused (exit=$EXIT status=$RESP2)"
else
  fail "unclaimed.example.test was NOT refused (exit=$EXIT status=$RESP2)"
fi

echo
pass "All local checks passed. Ready to provision edge-1."
