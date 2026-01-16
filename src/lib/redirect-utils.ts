/**
 * Utility functions for safe URL redirects
 * Prevents open redirect vulnerabilities by validating redirect URLs
 */

/**
 * Validates if a URL is safe to redirect to
 * Only allows same-origin URLs or relative paths
 * @param url - URL to validate
 * @param baseUrl - Base URL for validation (window.location.origin)
 * @returns true if URL is safe to redirect to
 */
export function isValidRedirectUrl(url: string, baseUrl: string): boolean {
    if (!url) return false;

    try {
        // Handle relative URLs
        if (url.startsWith('/')) {
            return true;
        }

        // Parse as absolute URL
        const parsed = new URL(url, baseUrl);

        // Only allow same-origin redirects
        return parsed.origin === new URL(baseUrl).origin;
    } catch {
        // Invalid URL
        return false;
    }
}

/**
 * Gets a safe redirect URL, falling back to a default if invalid
 * @param url - Requested redirect URL (can be null/undefined)
 * @param fallback - Fallback URL if requested URL is invalid
 * @param baseUrl - Base URL for validation (window.location.origin)
 * @returns Safe redirect URL
 */
export function getSafeRedirectUrl(
    url: string | null | undefined,
    fallback: string,
    baseUrl: string
): string {
    if (!url) return fallback;

    return isValidRedirectUrl(url, baseUrl) ? url : fallback;
}

/**
 * Server-side version of redirect validation
 * Uses request headers to determine base URL
 */
export function isValidServerRedirect(url: string, requestUrl: string): boolean {
    if (!url) return false;

    try {
        // Handle relative URLs
        if (url.startsWith('/')) {
            // Ensure it doesn't contain protocol-relative tricks
            if (url.startsWith('//')) return false;
            return true;
        }

        // Parse both URLs
        const requestOrigin = new URL(requestUrl).origin;
        const redirectUrl = new URL(url);

        // Only allow same-origin
        return redirectUrl.origin === requestOrigin;
    } catch {
        return false;
    }
}
