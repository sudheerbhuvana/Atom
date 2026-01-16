import { NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { isValidServerRedirect } from '@/lib/redirect-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request body
        const validationResult = loginSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: validationResult.error.issues[0]?.message || 'Invalid input' },
                { status: 400 }
            );
        }

        const { username, password } = validationResult.data;
        const { returnTo } = body;

        const result = await login(username, password);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 401 });
        }

        // Validate and return redirect URL if provided
        const baseUrl = request.headers.get('origin') || 'http://localhost:3000';
        let redirect = '/';

        if (returnTo && typeof returnTo === 'string') {
            // Validate returnTo is safe (same-origin or relative)
            if (isValidServerRedirect(returnTo, baseUrl)) {
                redirect = returnTo;
            } else {
                console.warn('Invalid returnTo URL rejected:', returnTo);
            }
        }

        return NextResponse.json({ success: true, redirect });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
