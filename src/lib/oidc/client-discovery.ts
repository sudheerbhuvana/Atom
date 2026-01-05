export interface OIDCProviderMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint?: string;
    jwks_uri: string;
}

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
        console.error(`OIDC Discovery failed for ${issuer}:`, error);
        throw error;
    }
}
