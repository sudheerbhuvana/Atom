import { NextRequest, NextResponse } from 'next/server';
import { checkServiceStatus } from '@/lib/status-checker';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const urlString = searchParams.get('url');

    if (!urlString) {
        return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const result = await checkServiceStatus(urlString);
    return NextResponse.json(result);
}
