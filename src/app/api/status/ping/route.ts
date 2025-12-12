import { NextResponse } from 'next/server';
import ping from 'ping';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const host = searchParams.get('host');

    if (!host) {
        return NextResponse.json({ error: 'Host parameter is required' }, { status: 400 });
    }

    try {
        // ping.promise.probe(host) returns { alive: boolean, time: number, ... }
        // On Windows, time might be 'unknown' or require parsing, but the library generally normalizes it.
        const res = await ping.promise.probe(host, {
            timeout: 2, // seconds
            extra: ["-c", "1"] // Linux/Mac count 1. Windows uses -n 1 by default in the lib?
            // actually the lib handles OS differences mostly, but let's trust defaults first.
        });

        return NextResponse.json({
            alive: res.alive,
            time: typeof res.time === 'number' ? res.time : 0,
            output: res.output
        });
    } catch (error) {
        console.error('Ping error:', error);
        return NextResponse.json({
            alive: false,
            time: 0,
            error: 'Ping failed'
        }, { status: 500 });
    }
}
