import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { SystemStats } from '@/types';

// Cache stats briefly to prevent system overload
let cachedStats: SystemStats | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 2000; // 2 seconds

export async function GET() {
    const now = Date.now();

    if (cachedStats && (now - lastFetchTime < CACHE_DURATION)) {
        return NextResponse.json(cachedStats);
    }

    try {
        const [cpu, mem, time, fsSize, osInfo] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.time(),
            si.fsSize(),
            si.osInfo()
        ]);

        const stats: SystemStats = {
            cpuLoad: Math.round(cpu.currentLoad),
            memTotal: mem.total,
            memUsed: mem.active,
            uptime: time.uptime,
            platform: osInfo.platform, // 'linux', 'darwin', 'win32'
            storage: fsSize.map(drive => ({
                fs: drive.fs,
                size: drive.size,
                used: drive.used
            })).slice(0, 2) // Limit to first 2 drives for UI simplicity
        };

        cachedStats = stats;
        lastFetchTime = now;

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Failed to fetch system stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
