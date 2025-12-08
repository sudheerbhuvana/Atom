import { NextRequest, NextResponse } from 'next/server';
import { checkServiceStatus, StatusResult } from '@/lib/status-checker';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { urls } = body;

        if (!Array.isArray(urls)) {
            return NextResponse.json({ error: 'urls array required' }, { status: 400 });
        }

        // Limit batch size to prevent abuse/timeout
        const safeUrls = urls.slice(0, 50);

        // Execute all checks in parallel
        const promises = safeUrls.map(async (url) => {
            const result = await checkServiceStatus(url);
            return { url, result };
        });

        const results = await Promise.all(promises);

        // Transform to map { url: result }
        const resultMap: Record<string, StatusResult> = {};
        results.forEach(({ url, result }) => {
            resultMap[url] = result;
        });

        return NextResponse.json({ results: resultMap });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
