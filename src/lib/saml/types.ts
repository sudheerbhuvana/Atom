/**
 * SAML 2.0 Type Definitions
 */

export interface SAMLServiceProvider {
    id: number;
    entity_id: string;
    name: string;
    description?: string;
    acs_url: string; // Assertion Consumer Service URL
    metadata_url?: string;
    sp_certificate?: string; // Service Provider's public certificate
    attribute_mapping: Record<string, string>; // Map SAML attributes to user fields
    sign_assertions: boolean;
    encrypt_assertions: boolean;
    created_at: string;
    updated_at: string;
}

export interface SAMLAttributeMapping {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    [key: string]: string | undefined;
}

export interface SAMLAssertionParams {
    issuer: string;
    recipient: string;
    audience: string;
    nameId: string;
    nameIdFormat: string;
    attributes: Record<string, string | string[]>;
    sessionIndex?: string;
    authnContextClassRef?: string;
}
