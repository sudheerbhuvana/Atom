export interface OIDCProviderMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint?: string;
    jwks_uri: string;
}

const KNOWN_PROVIDERS: Record<string, Partial<OIDCProviderMetadata>> = {
    'github.com': {
        authorization_endpoint: 'https://github.com/login/oauth/authorize',
        token_endpoint: 'https://github.com/login/oauth/access_token',
        userinfo_endpoint: 'https://api.github.com/user',
        jwks_uri: '', // GitHub doesn't have standard JWKS for OIDC
    },
    'www.github.com': {
        authorization_endpoint: 'https://github.com/login/oauth/authorize',
        token_endpoint: 'https://github.com/login/oauth/access_token',
        userinfo_endpoint: 'https://api.github.com/user',
        jwks_uri: '',
    }
};

export async function fetchOIDCConfiguration(issuer: string): Promise<OIDCProviderMetadata> {
    // Ensure issuer has no trailing slash for the suffix append, but standard says base + /.well-known
    const baseUrl = issuer.replace(/\/$/, '');
    const discoveryUrl = `${baseUrl}/.well-known/openid-configuration`;

    try {
        const res = await fetch(discoveryUrl, { next: { revalidate: 3600 } }); // Cache for 1 hour
        if (!res.ok) {
            throw new Error(`Failed to fetch OIDC config: ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.authorization_endpoint || !data.token_endpoint || !data.jwks_uri) {
            throw new Error('Invalid OIDC discovery document: Missing required endpoints');
        }

        return {
            issuer: data.issuer,
            authorization_endpoint: data.authorization_endpoint,
            token_endpoint: data.token_endpoint,
            userinfo_endpoint: data.userinfo_endpoint,
            jwks_uri: data.jwks_uri
        };
    } catch (error) {
        // Fallback for known non-OIDC providers
        try {
            const domain = new URL(issuer).hostname;
            // Remove 'www.' if present for key lookup, or check both
            if (KNOWN_PROVIDERS[domain]) {
                return {
                    issuer: issuer,
                    ...KNOWN_PROVIDERS[domain]
                } as OIDCProviderMetadata;
            }
        } catch (e) {
            // Invalid URL passed
        }

        console.error(`OIDC Discovery failed for ${issuer}:`, error);
        throw error;
    }
}
