import { NextRequest, NextResponse } from 'next/server';
import { fetchOIDCConfiguration } from '@/lib/oidc/client-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const config = await fetchOIDCConfiguration(url);
        return NextResponse.json(config);
    } catch (error) {
        console.error('Proxy discovery failed:', error);
        return NextResponse.json({ error: 'Failed to discover OIDC configuration' }, { status: 500 });
    }
}
