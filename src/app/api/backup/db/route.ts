import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const DATA_DIR = process.env.DATA_DIR || './data';
        const DB_PATH = path.join(DATA_DIR, 'atom.db');

        if (!fs.existsSync(DB_PATH)) {
            return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(DB_PATH);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Disposition': 'attachment; filename="atom.db"',
            },
        });
    } catch (e) {
        console.error('Download failed:', e);
        return NextResponse.json({ error: 'Failed to download database' }, { status: 500 });
    }
}
