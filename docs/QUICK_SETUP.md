# Quick Setup Guide - oauth2-proxy with Atom

## Prerequisites

1. **Atom dashboard running** on `http://atom:3000` (or your domain)
2. **Docker & Docker Compose** installed

## Setup Steps

### Step 1: Generate Cookie Secret

For each oauth2-proxy container, generate a unique cookie secret:

```bash
openssl rand -base64 32 | tr -- '+/' '-_'
```

Example output: `abc123DEF456ghi789JKL012mno345PQR=`

### Step 2: Create OAuth Clients in Atom

For each application, create an OAuth client:

**Via Atom UI:**
1. Go to `http://localhost:3000/settings`
2. Scroll to "SSO Provider" section
3. Click "Add Application"
4. Fill in:
   - **Name**: `Grafana` (or app name)
   - **Redirect URIs**: `http://localhost:8080/oauth2/callback` (match your setup)
   - **Allowed Scopes**: Select `openid`, `profile`, `email`
5. Click "Create"
6. **Copy the Client ID and Client Secret** (you'll need these!)

**Repeat for each app** (Sonarr, Radarr, etc.)

### Step 3: Update docker-compose.yml

Replace all `CHANGE_ME` values in `docker-compose.proxy-example.yml`:

```yaml
grafana-auth:
  command:
    - --client-id=abc123-from-atom-ui
    - --client-secret=secret456-from-atom-ui
    - --cookie-secret=xyz789-generated-above
    - --redirect-url=http://localhost:8080/oauth2/callback  # Your actual URL
```

### Step 4: Start Services

```bash
docker-compose -f docker-compose.proxy-example.yml up -d
```

### Step 5: Test

1. Visit `http://localhost:8080` (Grafana via proxy)
2. You'll be redirected to Atom login
3. Login with your Atom credentials
4. Redirected back to Grafana (auto-logged in!)

## Access URLs

After setup:

- **Atom Dashboard**: `http://localhost:3000`
- **Grafana** (protected): `http://localhost:8080`
- **Sonarr** (protected): `http://localhost:8989`
- **Radarr** (protected): `http://localhost:7878`

## Adding More Apps

To protect a new application:

1. **Add the app service** to docker-compose.yml
2. **Add oauth2-proxy sidecar**:
   ```yaml
   myapp-auth:
     image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
     command:
       - --provider=oidc
       - --oidc-issuer-url=http://172.30.0.2:3000
       - --client-id=myapp-client
       - --client-secret=myapp-secret
       - --cookie-secret=unique-32-chars
       - --redirect-url=http://localhost:PORT/oauth2/callback
       - --upstream=http://myapp:INTERNAL_PORT
       - --email-domain=*
       - --pass-user-headers=true
     ports:
       - "PORT:4180"
   ```
3. **Create OAuth client** in Atom UI
4. **Update values** and restart

## Production Tips

### Use HTTPS

```yaml
command:
  - --cookie-secure=true
  - --redirect-url=https://grafana.yourdomain.com/oauth2/callback
```

Update Atom:
```yaml
atom:
  environment:
    - OAUTH_ISSUER_URL=https://atom.yourdomain.com
```

### Restrict Users by Email

```yaml
command:
  - --email-domain=yourdomain.com  # Only @yourdomain.com emails
```

### Session Duration

```yaml
command:
  - --cookie-expire=12h
  - --cookie-refresh=1h
```

## Troubleshooting

### "Invalid client" error

- Check client ID and secret match what's in Atom
- Verify OAuth client is created in Atom UI

### Redirect loop

- Check `redirect-url` matches the public URL
- Ensure `cookie-secure=false` for HTTP (dev) or `true` for HTTPS (prod)

### "OIDC discovery failed"

- Verify Atom is running: `http://atom:3000`
- Test discovery: `curl http://atom:3000/.well-known/openid-configuration`

### Can't access app directly

- This is expected! App is only accessible via oauth2-proxy
- Access via proxy: `http://localhost:PORT` (not the app's internal port)

## Environment Variables Alternative

Instead of command flags, use environment variables:

```yaml
grafana-auth:
  image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
  environment:
    - OAUTH2_PROXY_PROVIDER=oidc
    - OAUTH2_PROXY_OIDC_ISSUER_URL=http://172.30.0.2:3000
    - OAUTH2_PROXY_CLIENT_ID=abc123
    - OAUTH2_PROXY_CLIENT_SECRET=secret456
    - OAUTH2_PROXY_COOKIE_SECRET=xyz789
    - OAUTH2_PROXY_REDIRECT_URL=http://localhost:8080/oauth2/callback
    - OAUTH2_PROXY_UPSTREAMS=http://172.30.0.10:3000
    - OAUTH2_PROXY_EMAIL_DOMAINS=*
    - OAUTH2_PROXY_PASS_USER_HEADERS=true
```

## Complete Example

See `docker-compose.proxy-example.yml` for working examples with:
- ✅ Grafana (with proxy header auth)
- ✅ Sonarr (any web app)
- ✅ Radarr (any web app)

All protected by Atom SSO!
