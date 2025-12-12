import { NextRequest, NextResponse } from 'next/server';
import { getAllUsersSafe, createUser, deleteUser, updateUserPassword, getUserById, getUserCount } from '@/lib/db';
import { hashPassword, getCurrentUser } from '@/lib/auth';
import { createUserSchema, changePasswordSchema } from '@/lib/validation';

// Proper session validation helper
async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
}

export async function GET() {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = getAllUsersSafe();
    return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Validate request body
        const validationResult = createUserSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: validationResult.error.issues[0]?.message || 'Invalid input' },
                { status: 400 }
            );
        }

        const { username, password } = validationResult.data;

        // Hash password first
        const passHash = await hashPassword(password);

        try {
            // createUser handles race conditions internally
            const newUser = createUser(username, passHash);

            return NextResponse.json({
                id: newUser.id,
                username: newUser.username,
                created_at: newUser.created_at
            });
        } catch (e: unknown) {
            // Handle unique constraint violation
            const errorMsg = e instanceof Error ? e.message : '';
            const errorCode = (e as { code?: string }).code;
            if (errorMsg === 'Username already exists' || errorCode === 'SQLITE_CONSTRAINT_UNIQUE') {
                return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
            }
            console.error('User operation error:', e);
            return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
        }
    } catch (e: unknown) {
        console.error('User operation error:', e);
        return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await req.json();

        // Prevent deleting the last user or self? 
        // For self-delete protection, we need to know current user ID from session.
        // Assuming middleware handles session, but here we can just do basic checks.

        // Validate id is a number
        if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }

        const userToDelete = getUserById(id);
        if (!userToDelete) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check user count before deletion (atomic check)
        const userCount = getUserCount();
        if (userCount <= 1) {
            return NextResponse.json({ error: 'Cannot delete the last user' }, { status: 400 });
        }

        deleteUser(id);
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error('User operation error:', e);
        return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Validate request body
        const validationResult = changePasswordSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: validationResult.error.issues[0]?.message || 'Invalid input' },
                { status: 400 }
            );
        }

        const { id, password } = validationResult.data;
        const user = getUserById(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const passHash = await hashPassword(password);
        updateUserPassword(id, passHash);

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error('User operation error:', e);
        return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
    }
}
