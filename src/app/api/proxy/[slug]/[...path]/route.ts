import { NextRequest } from 'next/server';
import { proxyRequest } from '../../../../../lib/proxy/auth-proxy';

/**
 * Authentication Proxy Endpoint
 * ALL /api/proxy/[slug]/[...path]
 * 
 * Proxies requests to protected backend applications with authentication
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string; path: string[] }> }
) {
    const { slug, path } = await context.params;
    const fullPath = '/' + (path || []).join('/');

    return proxyRequest(request, slug, fullPath);
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ slug: string; path: string[] }> }
) {
    const { slug, path } = await context.params;
    const fullPath = '/' + (path || []).join('/');

    return proxyRequest(request, slug, fullPath);
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ slug: string; path: string[] }> }
) {
    const { slug, path } = await context.params;
    const fullPath = '/' + (path || []).join('/');

    return proxyRequest(request, slug, fullPath);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ slug: string; path: string[] }> }
) {
    const { slug, path } = await context.params;
    const fullPath = '/' + (path || []).join('/');

    return proxyRequest(request, slug, fullPath);
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ slug: string; path: string[] }> }
) {
    const { slug, path } = await context.params;
    const fullPath = '/' + (path || []).join('/');

    return proxyRequest(request, slug, fullPath);
}
