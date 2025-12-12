import { NextResponse } from 'next/server';
import { register } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Validate request body
        const validationResult = registerSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: validationResult.error.issues[0]?.message || 'Invalid input' },
                { status: 400 }
            );
        }

        const { username, password } = validationResult.data;
        const result = await register(username, password);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}
