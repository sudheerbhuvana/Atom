import { getSAMLCertificate, getPublicCertificate } from './certificates';

export interface SAMLMetadataConfig {
    issuer: string; // Entity ID of IdP
    ssoServiceUrl: string; // SSO endpoint URL
    certificate: string; // Public certificate for signature verification
}

/**
 * Generate SAML 2.0 IdP Metadata (EntityDescriptor)
 */
export function generateSAMLMetadata(baseUrl?: string): string {
    const issuer = baseUrl || process.env.OAUTH_ISSUER_URL || 'http://localhost:3000';
    const entityId = `${issuer}/saml/metadata`;
    const ssoServiceUrl = `${issuer}/api/saml/sso`;

    // Get public certificate (without private key)
    const cert = getPublicCertificate();

    // Extract certificate content (remove headers and format)
    const certContent = cert
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\n/g, '');

    // Build SAML Metadata XML
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${entityId}">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    
    <!-- Signing Key -->
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certContent}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    
    <!-- Encryption Key (same as signing for now) -->
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certContent}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    
    <!-- Name ID Formats -->
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>
    
    <!-- Single Sign-On Service (HTTP-POST) -->
    <md:SingleSignOnService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${ssoServiceUrl}" />
    
    <!-- Single Sign-On Service (HTTP-Redirect) -->
    <md:SingleSignOnService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${ssoServiceUrl}" />
    
    <!-- Supported Attributes -->
    <md:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" />
    <md:Attribute Name="name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" />
    <md:Attribute Name="username" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" />
    <md:Attribute Name="groups" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" />
    
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

    return metadata;
}

/**
 * Get SAML metadata configuration (for programmatic access)
 */
export function getSAMLMetadataConfig(baseUrl?: string): SAMLMetadataConfig {
    const issuer = baseUrl || process.env.OAUTH_ISSUER_URL || 'http://localhost:3000';

    return {
        issuer: `${issuer}/saml/metadata`,
        ssoServiceUrl: `${issuer}/api/saml/sso`,
        certificate: getPublicCertificate(),
    };
}
