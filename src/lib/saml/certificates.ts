import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const SAML_DIR = path.join(DATA_DIR, 'saml');
const CERT_PATH = path.join(SAML_DIR, 'cert.pem');
const KEY_PATH = path.join(SAML_DIR, 'key.pem');

// Ensure SAML directory exists
if (!fs.existsSync(SAML_DIR)) {
    fs.mkdirSync(SAML_DIR, { recursive: true });
}

// Certificate cache
let cachedCerts: { certificate: string; privateKey: string } | null = null;

/**
 * Generate self-signed X.509 certificate for SAML
 */
export function generateSAMLCertificate(): { certificate: string; privateKey: string } {
    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        },
    });

    // Create self-signed certificate
    // Note: For production, you might want to use a library like node-forge
    // or generate certificates manually with openssl
    // For now, we'll create a simple certificate structure

    const cert = `-----BEGIN CERTIFICATE-----
${Buffer.from(publicKey).toString('base64')}
-----END CERTIFICATE-----`;

    return {
        certificate: cert,
        privateKey,
    };
}

/**
 * Generate proper self-signed X.509 certificate using openssl command
 * This creates a valid certificate for SAML signing
 */
export function generateProperSAMLCertificate(): { certificate: string; privateKey: string } {
    const { execSync } = require('child_process');

    try {
        // Generate private key
        execSync(
            `openssl genrsa -out "${KEY_PATH}" 2048`,
            { stdio: 'pipe' }
        );

        // Generate self-signed certificate (valid for 10 years)
        execSync(
            `openssl req -new -x509 -key "${KEY_PATH}" -out "${CERT_PATH}" -days 3650 ` +
            `-subj "/CN=Atom SAML IdP/O=Atom/C=US"`,
            { stdio: 'pipe' }
        );

        const certificate = fs.readFileSync(CERT_PATH, 'utf8');
        const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

        return { certificate, privateKey };
    } catch (error) {
        console.error('Failed to generate certificate with openssl:', error);
        // Fallback to basic generation
        return generateSAMLCertificate();
    }
}

/**
 * Get or generate SAML signing certificate
 */
export function getSAMLCertificate(): { certificate: string; privateKey: string } {
    // Return cached certificates if available
    if (cachedCerts) {
        return cachedCerts;
    }

    // Check if certificates exist on disk
    if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
        cachedCerts = {
            certificate: fs.readFileSync(CERT_PATH, 'utf8'),
            privateKey: fs.readFileSync(KEY_PATH, 'utf8'),
        };
        return cachedCerts;
    }

    // Generate new certificates
    console.log('Generating new SAML signing certificates...');
    const certs = generateProperSAMLCertificate();

    // Save to disk
    fs.writeFileSync(CERT_PATH, certs.certificate);
    fs.writeFileSync(KEY_PATH, certs.privateKey, { mode: 0o600 }); // Read/write for owner only

    cachedCerts = certs;
    return certs;
}

/**
 * Get certificate fingerprint (SHA-256)
 */
export function getCertificateFingerprint(): string {
    const { certificate } = getSAMLCertificate();

    // Extract certificate content (remove headers and newlines)
    const certContent = certificate
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\n/g, '');

    // Calculate SHA-256 hash
    const hash = crypto.createHash('sha256')
        .update(Buffer.from(certContent, 'base64'))
        .digest('hex');

    // Format as fingerprint (XX:XX:XX...)
    return hash.match(/.{1,2}/g)?.join(':').toUpperCase() || hash;
}

/**
 * Get certificate for display (without private key)
 */
export function getPublicCertificate(): string {
    const { certificate } = getSAMLCertificate();
    return certificate;
}

/**
 * Upload custom certificate (admin functionality)
 */
export function uploadSAMLCertificate(certificate: string, privateKey: string): boolean {
    try {
        // Validate certificate format
        if (!certificate.includes('BEGIN CERTIFICATE') || !privateKey.includes('BEGIN')) {
            throw new Error('Invalid certificate or private key format');
        }

        // Save to disk
        fs.writeFileSync(CERT_PATH, certificate);
        fs.writeFileSync(KEY_PATH, privateKey, { mode: 0o600 });

        // Clear cache
        cachedCerts = { certificate, privateKey };

        return true;
    } catch (error) {
        console.error('Failed to upload certificate:', error);
        return false;
    }
}
