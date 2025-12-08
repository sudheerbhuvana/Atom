import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { AppConfig } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
    const config = await getConfig();
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // In a real app, we should validate 'body' against a schema here (e.g. using Zod)
        // For now, we cast it, trusting the frontend types.
        const newConfig = body as AppConfig;

        const success = await saveConfig(newConfig);

        if (success) {
            return NextResponse.json({ success: true, config: newConfig });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to write config' }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}
