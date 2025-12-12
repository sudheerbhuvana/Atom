import { NextRequest, NextResponse } from 'next/server';
import { checkServiceStatus, StatusResult } from '@/lib/status-checker';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const batchRequestSchema = z.object({
    urls: z.array(z.string().url('Invalid URL format')).max(50, 'Maximum 50 URLs allowed')
});

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();

        // Validate request body
        const validationResult = batchRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: validationResult.error.issues[0]?.message || 'Invalid request' },
                { status: 400 }
            );
        }

        const { urls } = validationResult.data;

        // Limit batch size to prevent abuse/timeout
        const safeUrls = urls.slice(0, 50);

        // Execute all checks in parallel
        const promises = safeUrls.map(async (url) => {
            try {
                const result = await checkServiceStatus(url);
                return { url, result };
            } catch {
                return {
                    url,
                    result: {
                        up: false,
                        status: 0,
                        latency: 0,
                        method: 'fetch',
                        error: 'Check failed'
                    } as StatusResult
                };
            }
        });

        const results = await Promise.all(promises);

        // Transform to map { url: result }
        const resultMap: Record<string, StatusResult> = {};
        results.forEach(({ url, result }) => {
            resultMap[url] = result;
        });

        return NextResponse.json({ results: resultMap });

    } catch (error) {
        console.error('Batch status check error:', error);
        return NextResponse.json({ error: 'Failed to check service statuses' }, { status: 500 });
    }
}
