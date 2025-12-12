import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { AppConfig } from '@/types';
import { getCurrentUser } from '@/lib/auth';
import { appConfigSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Allow unauthenticated access for initial setup (onboarding)
    // Frontend will check if onboarding is needed
    const config = await getConfig();
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await request.json();
        
        // Validate request body against schema
        const validationResult = appConfigSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid configuration', details: validationResult.error.issues },
                { status: 400 }
            );
        }

        const newConfig = validationResult.data as AppConfig;
        const success = await saveConfig(newConfig);

        if (success) {
            return NextResponse.json({ success: true, config: newConfig });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to write config' }, { status: 500 });
        }
    } catch (error) {
        console.error('Config save error:', error);
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}
