import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
    createProtectedApplication,
    listProtectedApplications,
    getProtectedApplicationBySlug,
    updateProtectedApplication,
    deleteProtectedApplication,
} from '@/lib/proxy/db-proxy';

/**
 * GET /api/proxy/apps - List all protected applications
 */
export async function GET(request: NextRequest) {
    // Require authentication
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apps = listProtectedApplications();

    return NextResponse.json({ applications: apps });
}

/**
 * POST /api/proxy/apps - Create new protected application
 */
export async function POST(request: NextRequest) {
    // Require authentication
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, slug, backend_url, require_auth, allowed_users, inject_headers, strip_auth_header } = body;

        // Validation
        if (!name || !slug || !backend_url) {
            return NextResponse.json(
                { error: 'Missing required fields: name, slug, backend_url' },
                { status: 400 }
            );
        }

        // Validate slug format (alphanumeric and hyphens only)
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return NextResponse.json(
                { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' },
                { status: 400 }
            );
        }

        // Check if slug already exists
        const existing = getProtectedApplicationBySlug(slug);
        if (existing) {
            return NextResponse.json(
                { error: 'Application with this slug already exists' },
                { status: 409 }
            );
        }

        // Create application
        const app = createProtectedApplication(
            name,
            slug,
            backend_url,
            require_auth ?? true,
            allowed_users || null,
            inject_headers ?? true,
            strip_auth_header ?? true
        );

        return NextResponse.json({ application: app }, { status: 201 });
    } catch (error) {
        console.error('Failed to create protected application:', error);
        return NextResponse.json(
            { error: 'Failed to create application' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/proxy/apps?slug=... - Update protected application
 */
export async function PATCH(request: NextRequest) {
    // Require authentication
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
        return NextResponse.json(
            { error: 'Missing slug parameter' },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();

        const updated = updateProtectedApplication(slug, body);

        if (!updated) {
            return NextResponse.json(
                { error: 'Application not found' },
                { status: 404 }
            );
        }

        const app = getProtectedApplicationBySlug(slug);
        return NextResponse.json({ application: app });
    } catch (error) {
        console.error('Failed to update protected application:', error);
        return NextResponse.json(
            { error: 'Failed to update application' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/proxy/apps?slug=... - Delete protected application
 */
export async function DELETE(request: NextRequest) {
    // Require authentication
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
        return NextResponse.json(
            { error: 'Missing slug parameter' },
            { status: 400 }
        );
    }

    const deleted = deleteProtectedApplication(slug);

    if (!deleted) {
        return NextResponse.json(
            { error: 'Application not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({ message: 'Application deleted successfully' });
}
