# Forward Auth Proxy with Atom OIDC

## Complete Docker Compose Examples

This guide shows how to use Atom's OIDC as the SSO provider with oauth2-proxy as a standalone forward authentication proxy (similar to Authentik's proxy).

---

## Architecture

```
User Request → oauth2-proxy → Backend App
                    ↓
              Atom OIDC (SSO)
```

**oauth2-proxy** checks if user is authenticated:
- ✅ **Authenticated**: Proxies to backend with user headers
- ❌ **Not authenticated**: Redirects to Atom for login

---

## Example 1: Grafana with Forward Auth

```yaml
version: '3.8'

services:
  # Atom Dashboard (SSO Provider)
  atom:
    image: your-atom-image:latest
    ports:
      - "3000:3000"
    environment:
      - OAUTH_ISSUER_URL=http://atom:3000
    networks:
      - apps

  # Grafana (Backend Application)
  grafana:
    image: grafana/grafana:latest
    environment:
      # Configure Grafana to trust proxy headers
      - GF_AUTH_PROXY_ENABLED=true
      - GF_AUTH_PROXY_HEADER_NAME=X-Forwarded-User
      - GF_AUTH_PROXY_HEADER_PROPERTY=username
      - GF_AUTH_PROXY_AUTO_SIGN_UP=true
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - apps

  # oauth2-proxy (Forward Auth Proxy)
  grafana-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
    command:
      - --provider=oidc
      - --oidc-issuer-url=http://atom:3000
      - --client-id=grafana-client  # Create in Atom
      - --client-secret=your-secret-here
      - --cookie-secret=random-32-character-string-here
      - --redirect-url=http://localhost:8080/oauth2/callback
      - --upstream=http://grafana:3000
      - --email-domain=*
      - --pass-user-headers=true
      - --pass-access-token=true
      - --set-xauthrequest=true
      - --cookie-secure=false  # Set true in production with HTTPS
    ports:
      - "8080:4180"
    networks:
      - apps
    depends_on:
      - atom
      - grafana

networks:
  apps:
    driver: bridge
```

**Access:** `http://localhost:8080` → oauth2-proxy → Grafana

---

## Example 2: Multiple Apps with Traefik

Use Traefik as reverse proxy + oauth2-proxy for SSO:

```yaml
version: '3.8'

services:
  # Traefik Reverse Proxy
  traefik:
    image: traefik:v3.0
    command:
      - --api.insecure=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
    ports:
      - "80:80"
      - "8081:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - proxy

  # Atom Dashboard (SSO Provider)
  atom:
    image: your-atom-image:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.atom.rule=Host(`atom.localhost`)"
      - "traefik.http.services.atom.loadbalancer.server.port=3000"
    environment:
      - OAUTH_ISSUER_URL=http://atom.localhost
    networks:
      - proxy

  # oauth2-proxy for SSO
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
    command:
      - --provider=oidc
      - --oidc-issuer-url=http://atom.localhost
      - --client-id=proxy-client
      - --client-secret=your-secret
      - --cookie-secret=random-32-chars-xxxxxxxxxxxxxxxx
      - --redirect-url=http://auth.localhost/oauth2/callback
      - --email-domain=*
      - --upstream=static://202
      - --cookie-secure=false
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.oauth2-proxy.rule=Host(`auth.localhost`)"
      - "traefik.http.services.oauth2-proxy.loadbalancer.server.port=4180"
    networks:
      - proxy

  # Grafana (Protected App)
  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_AUTH_PROXY_ENABLED=true
      - GF_AUTH_PROXY_HEADER_NAME=X-Forwarded-User
      - GF_AUTH_PROXY_AUTO_SIGN_UP=true
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.localhost`)"
      - "traefik.http.routers.grafana.middlewares=oauth2-auth"
      - "traefik.http.middlewares.oauth2-auth.forwardauth.address=http://oauth2-proxy:4180"
      - "traefik.http.middlewares.oauth2-auth.forwardauth.authResponseHeaders=X-Auth-Request-User,X-Auth-Request-Email"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"
    networks:
      - proxy

  # Portainer (Another Protected App)
  portainer:
    image: portainer/portainer-ce:latest
    command: --http-enabled
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portainer.rule=Host(`portainer.localhost`)"
      - "traefik.http.routers.portainer.middlewares=oauth2-auth"  # Same auth!
      - "traefik.http.services.portainer.loadbalancer.server.port=9000"
    networks:
      - proxy

volumes:
  portainer_data:

networks:
  proxy:
    driver: bridge
```

**Access:**
- Atom: `http://atom.localhost`
- Grafana: `http://grafana.localhost` (SSO via Atom)
- Portainer: `http://portainer.localhost` (SSO via Atom)

---

## Example 3: Per-App Proxy (Authentik Style)

Each app gets its own dedicated proxy container:

```yaml
version: '3.8'

services:
  # Atom Dashboard
  atom:
    image: your-atom-image:latest
    ports:
      - "3000:3000"
    environment:
      - OAUTH_ISSUER_URL=http://atom:3000
    networks:
      - media_stack

  # Sonarr
  sonarr:
    image: linuxserver/sonarr:latest
    environment:
      - PUID=1000
      - PGID=1000
    volumes:
      - ./sonarr:/config
    networks:
      media_stack:
        ipv4_address: 172.30.0.10

  # Sonarr Auth Proxy
  sonarr-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
    environment:
      - OAUTH2_PROXY_PROVIDER=oidc
      - OAUTH2_PROXY_OIDC_ISSUER_URL=http://atom:3000
      - OAUTH2_PROXY_CLIENT_ID=sonarr-client
      - OAUTH2_PROXY_CLIENT_SECRET=sonarr-secret
      - OAUTH2_PROXY_COOKIE_SECRET=random32chars_xxxxxxxxxxxxxxxx
      - OAUTH2_PROXY_REDIRECT_URL=http://sonarr.yourdomain.com/oauth2/callback
      - OAUTH2_PROXY_UPSTREAMS=http://172.30.0.10:8989
      - OAUTH2_PROXY_EMAIL_DOMAINS=*
      - OAUTH2_PROXY_PASS_USER_HEADERS=true
      - OAUTH2_PROXY_COOKIE_SECURE=false
    ports:
      - "8989:4180"
    networks:
      media_stack:
        ipv4_address: 172.30.0.11

  # Radarr  
  radarr:
    image: linuxserver/radarr:latest
    environment:
      - PUID=1000
      - PGID=1000
    volumes:
      - ./radarr:/config
    networks:
      media_stack:
        ipv4_address: 172.30.0.12

  # Radarr Auth Proxy
  radarr-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
    environment:
      - OAUTH2_PROXY_PROVIDER=oidc
      - OAUTH2_PROXY_OIDC_ISSUER_URL=http://atom:3000
      - OAUTH2_PROXY_CLIENT_ID=radarr-client
      - OAUTH2_PROXY_CLIENT_SECRET=radarr-secret
      - OAUTH2_PROXY_COOKIE_SECRET=random32chars_yyyyyyyyyyyyyyyy
      - OAUTH2_PROXY_REDIRECT_URL=http://radarr.yourdomain.com/oauth2/callback
      - OAUTH2_PROXY_UPSTREAMS=http://172.30.0.12:7878
      - OAUTH2_PROXY_EMAIL_DOMAINS=*
      - OAUTH2_PROXY_PASS_USER_HEADERS=true
      - OAUTH2_PROXY_COOKIE_SECURE=false
    ports:
      - "7878:4180"
    networks:
      media_stack:
        ipv4_address: 172.30.0.13

networks:
  media_stack:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
```

---

## Setup Steps

### 1. Create OAuth2 Client in Atom

Via Atom UI (`Settings → SSO Provider`):
1. Click "Add Application"
2. Name: `Grafana` (or app name)
3. Redirect URIs: `http://localhost:8080/oauth2/callback`
4. Allowed Scopes: `openid`, `profile`, `email`
5. Save and copy **Client ID** and **Client Secret**

Or via API:
```bash
curl -X POST http://localhost:3000/api/oauth/clients \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "name": "Grafana",
    "redirect_uris": ["http://localhost:8080/oauth2/callback"],
    "allowed_scopes": ["openid", "profile", "email"],
    "grant_types": ["authorization_code", "refresh_token"]
  }'
```

### 2. Generate Cookie Secret

```bash
python -c 'import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())'
# or
openssl rand -base64 32 | tr -- '+/' '-_'
```

### 3. Configure Backend App

Most apps support proxy authentication via headers:

**Grafana:**
```ini
[auth.proxy]
enabled = true
header_name = X-Forwarded-User
auto_sign_up = true
```

**Nextcloud (config.php):**
```php
'trusted_proxies' => ['172.30.0.0/24'],
'forwarded_for_headers' => ['HTTP_X_FORWARDED_FOR'],
```

**Generic App:**
Configure to trust `X-Forwarded-User` or `X-Remote-User` header

### 4. Start Services

```bash
docker-compose up -d
```

### 5. Test

1. Visit `http://localhost:8080`
2. Redirect to Atom login
3. Login with Atom credentials
4. Redirect back to app (auto-logged in)

---

## Environment Variables Reference

### oauth2-proxy Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `OAUTH2_PROXY_PROVIDER` | OAuth provider type | `oidc` |
| `OAUTH2_PROXY_OIDC_ISSUER_URL` | Atom's OIDC issuer | `http://atom:3000` |
| `OAUTH2_PROXY_CLIENT_ID` | From Atom OAuth client | `abc123...` |
| `OAUTH2_PROXY_CLIENT_SECRET` | From Atom OAuth client | `secret123...` |
| `OAUTH2_PROXY_COOKIE_SECRET` | Random 32 chars | `xxx...` |
| `OAUTH2_PROXY_REDIRECT_URL` | Callback URL | `http://app.com/oauth2/callback` |
| `OAUTH2_PROXY_UPSTREAMS` | Backend app URL | `http://grafana:3000` |
| `OAUTH2_PROXY_EMAIL_DOMAINS` | Allowed email domains | `*` (all) |
| `OAUTH2_PROXY_PASS_USER_HEADERS` | Inject user headers | `true` |
| `OAUTH2_PROXY_COOKIE_SECURE` | HTTPS only cookies | `false` (dev), `true` (prod) |

---

## Injected Headers

oauth2-proxy injects these headers to the backend:

- `X-Forwarded-User`: Username
- `X-Forwarded-Email`: Email
- `X-Auth-Request-User`: Username (alternative)
- `X-Auth-Request-Email`: Email (alternative)
- `Authorization`: Bearer token

---

## Production Considerations

### HTTPS/TLS

```yaml
oauth2-proxy:
  environment:
    - OAUTH2_PROXY_COOKIE_SECURE=true
    - OAUTH2_PROXY_REDIRECT_URL=https://app.yourdomain.com/oauth2/callback
```

### Session Duration

```yaml
oauth2-proxy:
  environment:
    - OAUTH2_PROXY_COOKIE_EXPIRE=12h
    - OAUTH2_PROXY_COOKIE_REFRESH=1h
```

### Restrict Users

```yaml
oauth2-proxy:
  environment:
    - OAUTH2_PROXY_EMAIL_DOMAINS=yourdomain.com
    # or
    - OAUTH2_PROXY_AUTHENTICATED_EMAILS_FILE=/emails.txt
```

---

## Testing the Setup

### 1. Check Atom OIDC Discovery

```bash
curl http://localhost:3000/.well-known/openid-configuration | jq
```

### 2. Check oauth2-proxy Health

```bash
curl http://localhost:4180/ping
# Should return: OK
```

### 3. Test Auth Flow

```bash
# Visit protected app
curl -I http://localhost:8080/

# Should redirect to Atom for login
# Location: http://atom:3000/api/oauth/authorize?...
```

---

## Summary

✅ **Atom provides:** OIDC/OAuth2 SSO  
✅ **oauth2-proxy provides:** Forward authentication  
✅ **Works with:** Any app that trusts proxy headers  
✅ **Deployment:** One proxy per app (Authentik-style)  

This is the **production-ready, industry-standard** approach for SSO!
