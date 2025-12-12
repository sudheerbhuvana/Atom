import { NextResponse } from 'next/server';
import { getCurrentUser, needsOnboarding } from '@/lib/auth';

export const dynamic = 'force-dynamic';


export async function GET() {
    try {
        const needsSetup = needsOnboarding();

        if (needsSetup) {
            return NextResponse.json({ needsOnboarding: true });
        }

        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ user: null });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Session error:', error);
        return NextResponse.json({ error: 'Session check failed' }, { status: 500 });
    }
}
