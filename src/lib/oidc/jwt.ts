import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Key storage paths
const DATA_DIR = process.env.DATA_DIR || './data';
const KEYS_DIR = path.join(DATA_DIR, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'jwt-private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'jwt-public.pem');

// Ensure keys directory exists
if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
}

// Key pair cache
let cachedKeyPair: { privateKey: string; publicKey: string } | null = null;

/**
 * Generate RSA key pair for JWT signing
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
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

    return { privateKey, publicKey };
}

/**
 * Get or generate JWT signing keys
 */
export function getJWTKeys(): { privateKey: string; publicKey: string } {
    // Return cached keys if available
    if (cachedKeyPair) {
        return cachedKeyPair;
    }

    // Check if keys exist on disk
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
        cachedKeyPair = {
            privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
            publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
        };
        return cachedKeyPair;
    }

    // Generate new keys
    console.log('Generating new JWT signing keys...');
    const keyPair = generateKeyPair();

    // Save to disk
    fs.writeFileSync(PRIVATE_KEY_PATH, keyPair.privateKey, { mode: 0o600 }); // Read/write for owner only
    fs.writeFileSync(PUBLIC_KEY_PATH, keyPair.publicKey);

    cachedKeyPair = keyPair;
    return keyPair;
}

/**
 * Get public key ID (kid) for JWKS
 */
export function getKeyId(): string {
    const { publicKey } = getJWTKeys();
    // Generate stable key ID from public key hash
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    return hash.substring(0, 16);
}

// JWT Token Types
export interface JWTPayload {
    sub: string;          // Subject (user ID)
    iss: string;          // Issuer
    aud: string | string[]; // Audience (client ID)
    exp: number;          // Expiration time
    iat: number;          // Issued at
    nonce?: string;       // Nonce for replay protection
}

export interface IDTokenPayload extends JWTPayload {
    preferred_username?: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
}

export interface AccessTokenPayload extends JWTPayload {
    scope: string;
    client_id: string;
}

/**
 * Generate ID Token (for OIDC)
 */
export function generateIDToken(
    userId: number,
    username: string,
    clientId: string,
    email?: string,
    nonce?: string,
    expiresIn = 3600,
    issuerUrl?: string
): string {
    const { privateKey } = getJWTKeys();
    const now = Math.floor(Date.now() / 1000);
    const issuer = issuerUrl || process.env.OAUTH_ISSUER_URL || 'http://localhost:3000';

    const payload: IDTokenPayload = {
        sub: userId.toString(),
        iss: issuer,
        aud: clientId,
        exp: now + expiresIn,
        iat: now,
        preferred_username: username,
        name: username,
        ...(email && { email, email_verified: true }),
        // Add nonce if provided (for replay protection)
        ...(nonce && { nonce }),
    };

    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: getKeyId(),
    });
}

/**
 * Generate Access Token as JWT
 */
export function generateAccessTokenJWT(
    userId: number | null,
    clientId: string,
    scopes: string[],
    expiresIn = 3600,
    issuerUrl?: string
): string {
    const { privateKey } = getJWTKeys();
    const now = Math.floor(Date.now() / 1000);
    const issuer = issuerUrl || process.env.OAUTH_ISSUER_URL || 'http://localhost:3000';

    const payload: AccessTokenPayload = {
        sub: userId?.toString() || clientId, // For client_credentials, sub is client_id
        iss: issuer,
        aud: clientId,
        exp: now + expiresIn,
        iat: now,
        scope: scopes.join(' '),
        client_id: clientId,
    };

    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: getKeyId(),
    });
}

/**
 * Verify JWT token
 */
export function verifyJWT(token: string): JWTPayload {
    const { publicKey } = getJWTKeys();

    try {
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
        }) as JWTPayload;

        return decoded;
    } catch (error) {
        throw new Error(`Invalid JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Decode JWT without verification (for debugging)
 */
export function decodeJWT(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Get JWKS (JSON Web Key Set) for public key distribution
 */
export function getJWKS(): object {
    const { publicKey } = getJWTKeys();

    // Convert PEM to JWK format
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: 'jwk' });

    return {
        keys: [
            {
                ...jwk,
                kid: getKeyId(),
                use: 'sig',
                alg: 'RS256',
            },
        ],
    };
}
