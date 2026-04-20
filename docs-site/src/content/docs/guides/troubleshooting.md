---
title: Troubleshooting
description: Common issues with Hee and how to fix them.
sidebar:
  order: 3
---

## Domain stays "Unverified"

**Symptom**: You registered a domain 30+ minutes ago, but the portal still shows a yellow "Unverified" badge.

**Most likely causes**:

1. **Customer hasn't added CNAME** — confirm with:
   ```bash
   dig +short CNAME docs.customer.com
   # Expected: edge.hee.la.
   # Actual (broken): nothing, or wrong target
   ```
2. **Cloudflare proxied record** — grey-cloud only. Orange-cloud breaks TLS.
3. **Typo in hostname** — Hee's verification is case-sensitive on the **record value**. `Edge.Hee.La` fails; `edge.hee.la` works. Names are case-insensitive per DNS but some providers normalize weirdly.
4. **CNAME on apex** — RFC 1912 forbids CNAMEs on apex domains. Use a subdomain or ALIAS/CNAME flattening.

**Fix**: once the CNAME is correct, Hee's probe runs every 5 minutes and will flip verified automatically.

## 502 Bad Gateway

**Symptom**: Browser shows "502 Bad Gateway" when hitting the custom domain.

**Diagnosis**:

```bash
# 1. Is Hee's edge up?
curl https://edge.hee.la/
# Expected: "hee edge alive"

# 2. Is the upstream reachable?
curl -I https://your-upstream-url-here/
# If this fails, Hee is healthy; your upstream is the problem.

# 3. Is the upstream URL set correctly?
curl "https://api.hee.la/v1/edge/resolve?hostname=docs.customer.com" \
  -H "Authorization: Bearer $HEE_API_TOKEN"
# Check the returned `upstreamUrl` matches what you expect.
```

**Common causes**:

- Upstream is deploying / warming up — 502s for <60 s during a deploy are normal for serverless upstreams.
- Wrong upstream URL on the project — edit in portal.
- Upstream firewall blocking Hee's IP (`49.13.214.28`) — add to allowlist.

## `NET::ERR_CERT_AUTHORITY_INVALID`

**Symptom**: Browser refuses to load with "your connection is not private."

**Cause**: Hee hasn't yet issued a cert for this hostname — first request is still pending.

**Fix**: Wait 10 seconds, reload. Let's Encrypt issuance takes ~3 s but your first request has to complete the challenge dance. Second request will be fast.

If it persists after a minute:

- Check CNAME is correct (`dig +short CNAME docs.customer.com`)
- Check the domain is registered in Hee (portal shows it)
- Check no CAA record blocks Let's Encrypt (`dig customer.com CAA` should either be empty or include `letsencrypt.org`)

## `Too Many Requests` during cert issuance

**Symptom**: Customer's domain fails to issue TLS with a rate-limit error.

**Cause**: Let's Encrypt has a 50 certs / week / registered-domain limit. If your customer registered 50 subdomains of `customer.com` in a week, the next one blocks.

**Fix**:

- Wait for the rolling window to reset (7 days from the oldest issue).
- Contact [ops@hee.la](mailto:ops@hee.la) — we can add their domain to the Let's Encrypt override list if it's a legitimate enterprise case.

In practice this only hits customers deploying hundreds of subdomains at once — your average SaaS won't see it.

## Portal says "Project not found" but it exists

**Symptom**: You click on a project from the list and get a 404.

**Cause**: Your session auth doesn't include this project (likely because you were invited after your session cookie was issued).

**Fix**: Sign out + sign back in with a fresh magic link. Session refreshes full membership list on login.

## API token returns 401 Unauthorized

**Symptom**: `curl` with a valid-looking token returns 401.

**Diagnosis**:

```bash
# Verify token format
echo "$HEE_API_TOKEN" | grep -E '^hee_[a-f0-9]{64}$'
# Empty output = wrong format
```

**Common causes**:

- Token was revoked in the portal — issue a new one.
- Token was for a different project than the endpoint's path — tokens are project-scoped.
- Token has leading/trailing whitespace — `.env` files sometimes paste with line breaks.

## "hostname already claimed" (409 Conflict)

**Symptom**: `POST /v1/edge/domains` returns 409.

**Cause**: Another Hee project has already registered this hostname. Cross-tenant uniqueness is enforced — one hostname, one project.

**Fix**: If it's your own other project, remove it there first. If it's a different Hee customer's project (rare — means someone is trying to squat your customer's domain), email [ops@hee.la](mailto:ops@hee.la) with proof of ownership; we transfer registrations when disputes arise.

## Portal login magic link doesn't arrive

**Symptom**: You requested a magic link, never got the email.

**Diagnosis**:

- Check spam folder (Postmark DKIM is verified but custom domains may still filter).
- Check the exact email you entered — any typo means the link went elsewhere.

**Fix**:

- Request a new link from [app.hee.la/login](https://app.hee.la/login).
- Whitelist `@hee.la` in your mail provider.
- If still nothing after 5 min, email [ops@hee.la](mailto:ops@hee.la) — we can check Postmark delivery logs.

## Still stuck?

Email [ops@hee.la](mailto:ops@hee.la) with:

- Your project slug
- The hostname involved (if any)
- Exact error message + timestamp
- Output of the diagnostic `curl`s above

Response time is typically under 4 hours during EU business hours.
