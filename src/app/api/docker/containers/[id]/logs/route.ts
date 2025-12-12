import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const docker = new Docker();
        const container = docker.getContainer(id);
        const containerInfo = await container.inspect();
        const isTty = containerInfo.Config.Tty;

        const logsStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail: 100
        });

        const stream = new ReadableStream({
            start(controller) {
                console.log(`Stream started for ${id} (TTY: ${isTty})`);

                if (isTty) {
                    // TTY mode: Stream is raw raw, explicitly just pass it through
                    logsStream.on('data', (chunk: Buffer) => {
                        controller.enqueue(chunk);
                    });
                } else {
                    // Multiplexed mode: Parse 8-byte headers
                    // Header: [STREAM_TYPE (1b)] [0 0 0] [SIZE (4b big endian)]
                    let buffer = Buffer.alloc(0);

                    logsStream.on('data', (chunk: Buffer) => {
                        buffer = Buffer.concat([buffer, chunk]);

                        while (buffer.length > 0) {
                            if (buffer.length < 8) {
                                break; // Wait for more data
                            }

                            // Read header
                            // const type = buffer[0]; // 1 = stdout, 2 = stderr
                            const payloadSize = buffer.readUInt32BE(4);

                            if (buffer.length < 8 + payloadSize) {
                                break; // Wait for full payload
                            }

                            // Extract payload
                            const payload = buffer.subarray(8, 8 + payloadSize);
                            controller.enqueue(payload);

                            // Advance buffer
                            buffer = buffer.subarray(8 + payloadSize);
                        }
                    });
                }

                logsStream.on('end', () => {
                    controller.close();
                });

                logsStream.on('error', (err: unknown) => {
                    controller.error(err);
                });
            },
            cancel() {
                if (logsStream && typeof (logsStream as unknown as { destroy?: () => void }).destroy === 'function') {
                    (logsStream as unknown as { destroy: () => void }).destroy();
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Docker Log Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logs', details: errorMsg },
            { status: 500 }
        );
    }
}
