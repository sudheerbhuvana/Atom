import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, createUser, deleteUser, updateUserPassword, getUserByUsername, getUserById } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

// Simple session check helper
async function isAuthenticated() {
    const cookieStore = await cookies();
    return !!cookieStore.get('atom_session');
}

export async function GET() {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = getAllUsers();
    // Remove password hashes
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        created_at: u.created_at
    }));

    return NextResponse.json(safeUsers);
}

export async function POST(req: NextRequest) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { username, password } = await req.json();

        if (!username || !password || password.length < 8) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        if (getUserByUsername(username)) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        const passHash = await hashPassword(password);
        const newUser = createUser(username, passHash);

        return NextResponse.json({
            id: newUser.id,
            username: newUser.username,
            created_at: newUser.created_at
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
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

        const users = getAllUsers();
        if (users.length <= 1) {
            return NextResponse.json({ error: 'Cannot delete the last user' }, { status: 400 });
        }

        deleteUser(id);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, password } = await req.json();

        if (!id || !password || password.length < 8) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const user = getUserById(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const passHash = await hashPassword(password);
        updateUserPassword(id, passHash);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
