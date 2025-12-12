import { NextRequest, NextResponse } from 'next/server';
import { checkServiceStatus } from '@/lib/status-checker';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const urlSchema = z.string().url('Invalid URL format');

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const urlString = searchParams.get('url');

    if (!urlString) {
        return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    // Validate URL format
    const validationResult = urlSchema.safeParse(urlString);
    if (!validationResult.success) {
        return NextResponse.json(
            { error: validationResult.error.issues[0]?.message || 'Invalid URL' },
            { status: 400 }
        );
    }

    try {
        const result = await checkServiceStatus(validationResult.data);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Status check error:', error);
        return NextResponse.json({ error: 'Failed to check service status' }, { status: 500 });
    }
}
