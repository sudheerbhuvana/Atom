import { NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';

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
        const result = await login(username, password);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 401 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
