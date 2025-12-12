import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    // Security: Ensure user is authenticated to prevent open proxy abuse
    const user = await getCurrentUser();
    if (!user) {
        console.error('Proxy Auth Failed: No user found via getCurrentUser');
        return NextResponse.json({ error: 'Atom Proxy Unauthorized: Please log in again.' }, { status: 403 });
    }

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    try {
        const res = await fetch(targetUrl);

        if (!res.ok) {
            return NextResponse.json(
                { error: `Proxy received ${res.status} from target` },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Proxy error for ${targetUrl}:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch target URL', details: errorMsg },
            { status: 502 }
        );
    }
}
