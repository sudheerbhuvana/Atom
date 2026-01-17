/**
 * Authentication Proxy Types
 */

export interface ProtectedApplication {
    id: number;
    name: string;
    slug: string; // URL path: /proxy/{slug}/*
    backend_url: string; // Target backend URL
    require_auth: boolean; // Require authentication
    allowed_users: string[] | null; // Whitelist of usernames, or null for all
    inject_headers: boolean; // Inject X-Auth-* headers
    strip_auth_header: boolean; // Strip Authorization header
    created_at: string;
    updated_at: string;
}

export interface ProxyRequest {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
}

export interface AuthInfo {
    userId: number;
    username: string;
    email?: string;
}
