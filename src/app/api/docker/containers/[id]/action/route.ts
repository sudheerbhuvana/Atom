import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { action } = await request.json();

    try {
        const docker = new Docker();
        const container = docker.getContainer(id);

        let message = '';

        switch (action) {
            case 'start':
                await container.start();
                message = 'Container started successfully';
                break;
            case 'stop':
                await container.stop();
                message = 'Container stopped successfully';
                break;
            case 'restart':
                await container.restart();
                message = 'Container restarted successfully';
                break;
            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, message });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Docker Action Error (${action}):`, error);
        return NextResponse.json(
            { error: `Failed to ${action} container`, details: errorMsg },
            { status: 500 }
        );
    }
}
