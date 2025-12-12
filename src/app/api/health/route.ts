import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Docker container monitoring
 * Returns 200 OK if the application is running
 */
export async function GET() {
    return NextResponse.json(
        {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
        { status: 200 }
    );
}
