import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listProxyHosts, createProxyHost, deleteProxyHost } from '@/lib/proxy/db-proxy-hosts';

export const dynamic = 'force-dynamic';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const hosts = listProxyHosts();
        return NextResponse.json({ hosts });
    } catch (error) {
        console.error('Failed to fetch proxy hosts:', error);
        return NextResponse.json({ error: 'Failed to fetch proxy hosts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { domain, targetPort, ssl, letsencrypt } = await request.json();

        if (!domain || !targetPort) {
            return NextResponse.json({ error: 'Missing domain or target port' }, { status: 400 });
        }

        const newHost = createProxyHost(domain, targetPort, !!ssl, !!letsencrypt);
        return NextResponse.json(newHost);
    } catch (error) {
        console.error('Failed to create proxy host:', error);
        return NextResponse.json({ error: 'Failed to create proxy host' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'Missing host ID' }, { status: 400 });
        }

        const success = deleteProxyHost(id);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Host not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Failed to delete proxy host:', error);
        return NextResponse.json({ error: 'Failed to delete proxy host' }, { status: 500 });
    }
}
