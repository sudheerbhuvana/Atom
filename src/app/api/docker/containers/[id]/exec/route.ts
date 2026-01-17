import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { Duplex } from 'stream';

export const dynamic = 'force-dynamic';

// Store active exec sessions in memory (consider Redis for production)
const activeSessions = new Map<string, { stream: Duplex; exec: Docker.Exec }>();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const docker = new Docker();
        const container = docker.getContainer(id);

        // Create exec instance for interactive shell
        const exec = await container.exec({
            Cmd: ['/bin/sh'],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        // Start exec and get stream
        const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: true,
        }) as unknown as Duplex;

        // Store session for input handling
        const sessionId = `${id}-${Date.now()}`;
        activeSessions.set(sessionId, { stream, exec });

        // Clean up after 30 minutes
        setTimeout(() => {
            activeSessions.delete(sessionId);
            stream.destroy();
        }, 30 * 60 * 1000);

        // Create readable stream for response
        const readableStream = new ReadableStream({
            start(controller) {
                // Send session ID as first message
                controller.enqueue(new TextEncoder().encode(`SESSION:${sessionId}\n`));

                stream.on('data', (chunk: Buffer) => {
                    controller.enqueue(chunk);
                });

                stream.on('end', () => {
                    activeSessions.delete(sessionId);
                    controller.close();
                });

                stream.on('error', (err: Error) => {
                    console.error('Exec stream error:', err);
                    activeSessions.delete(sessionId);
                    controller.error(err);
                });
            },
            cancel() {
                activeSessions.delete(sessionId);
                stream.destroy();
            }
        });

        return new NextResponse(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Content-Type-Options': 'nosniff',
                'X-Session-Id': sessionId,
            },
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Docker Exec Error:', error);
        return NextResponse.json(
            { error: 'Failed to create exec session', details: errorMsg },
            { status: 500 }
        );
    }
}

// Handle input to exec session
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    await params; // consume params

    try {
        const body = await request.json();
        const { sessionId, data } = body;

        if (!sessionId || data === undefined) {
            return NextResponse.json({ error: 'Missing sessionId or data' }, { status: 400 });
        }

        const session = activeSessions.get(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
        }

        // Write data to stdin
        session.stream.write(data);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Exec input error:', error);
        return NextResponse.json({ error: 'Failed to send input', details: errorMsg }, { status: 500 });
    }
}
