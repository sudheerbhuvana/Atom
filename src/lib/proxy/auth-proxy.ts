import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../auth';
import type { AuthInfo } from './types';
import { getProtectedApplicationBySlug } from './db-proxy';

/**
 * Check if user is authenticated and authorized for the application
 */
export async function checkAuth(
    request: NextRequest,
    appSlug: string
): Promise<{ authorized: boolean; user?: AuthInfo; error?: string }> {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
        return {
            authorized: false,
            error: 'Authentication required',
        };
    }

    // Get application config
    const app = getProtectedApplicationBySlug(appSlug);
    if (!app) {
        return {
            authorized: false,
            error: 'Application not found',
        };
    }

    // Check if authentication is required
    if (!app.require_auth) {
        return {
            authorized: true,
            user: {
                userId: user.id,
                username: user.username,
            },
        };
    }

    // Check if user is in allowed list
    if (app.allowed_users && app.allowed_users.length > 0) {
        if (!app.allowed_users.includes(user.username)) {
            return {
                authorized: false,
                error: 'Access denied: user not authorized for this application',
            };
        }
    }

    return {
        authorized: true,
        user: {
            userId: user.id,
            username: user.username,
        },
    };
}

/**
 * Inject authentication headers for backend application
 */
export function injectAuthHeaders(
    headers: Headers,
    user: AuthInfo,
    injectHeaders: boolean,
    stripAuthHeader: boolean
): Headers {
    const newHeaders = new Headers(headers);

    // Strip Authorization header if configured
    if (stripAuthHeader) {
        newHeaders.delete('authorization');
        newHeaders.delete('Authorization');
    }

    // Inject auth headers if configured
    if (injectHeaders) {
        newHeaders.set('X-Auth-User', user.username);
        newHeaders.set('X-Auth-User-Id', user.userId.toString());

        if (user.email) {
            newHeaders.set('X-Auth-Email', user.email);
        }

        // Add remote user header (common standard)
        newHeaders.set('X-Remote-User', user.username);

        // Add forwarded headers
        newHeaders.set('X-Forwarded-User', user.username);
    }

    return newHeaders;
}

/**
 * Proxy request to backend with authentication
 */
export async function proxyRequest(
    request: NextRequest,
    appSlug: string,
    path: string
): Promise<NextResponse> {
    // Check authentication
    const authCheck = await checkAuth(request, appSlug);

    if (!authCheck.authorized) {
        // Redirect to login for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('returnTo', request.url);
            return NextResponse.redirect(loginUrl.toString());
        }

        // Return 401 for API requests
        return NextResponse.json(
            { error: authCheck.error || 'Unauthorized' },
            { status: 401 }
        );
    }

    // Get application config
    const app = getProtectedApplicationBySlug(appSlug)!;

    // Build backend URL
    const backendUrl = new URL(path, app.backend_url);

    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
        backendUrl.searchParams.set(key, value);
    });

    // Prepare headers
    const headers = injectAuthHeaders(
        request.headers,
        authCheck.user!,
        app.inject_headers,
        app.strip_auth_header
    );

    // Remove host header to avoid confusion
    headers.delete('host');

    try {
        // Forward request to backend
        const response = await fetch(backendUrl.toString(), {
            method: request.method,
            headers: headers,
            body: request.body,
            // @ts-ignore
            duplex: 'half', // Required for streaming request bodies
        });

        // Create response with backend content
        const responseHeaders = new Headers(response.headers);

        // Remove hop-by-hop headers
        responseHeaders.delete('transfer-encoding');
        responseHeaders.delete('connection');
        responseHeaders.delete('keep-alive');

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error(`Proxy error for ${appSlug}:`, error);
        return NextResponse.json(
            { error: 'Backend service unavailable' },
            { status: 502 }
        );
    }
}
