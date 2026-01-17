'use client';

import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import styles from './ContainerExecModal.module.css';
import { createPortal } from 'react-dom';

interface Props {
    containerId: string;
    containerName: string;
    onClose: () => void;
}

export default function ContainerExecModal({ containerId, containerName, onClose }: Props) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const xtermRef = useRef<{ term: any; fitAddon: any } | null>(null);

    // Ensure we only render the portal on the client
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        let isTerminalMounted = true;
        let sessionId: string | null = null;
        const abortController = new AbortController();

        // Dynamically import xterm to avoid SSR issues
        import('xterm').then(async ({ Terminal }) => {
            if (!isTerminalMounted || !terminalRef.current) return;

            const { FitAddon } = await import('xterm-addon-fit');

            const term = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                scrollback: 10000,
                convertEol: true,
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                }
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);

            // Store reference for resize handling
            xtermRef.current = { term, fitAddon };

            // Initial fit and setup resize listener
            const handleResize = () => {
                if (!isTerminalMounted || !terminalRef.current) return;
                try {
                    const dims = fitAddon.proposeDimensions();
                    if (dims) {
                        // Fit columns to width, but keep rows based on content
                        // Add +3 rows buffer to prevent clipping the last line
                        const currentBufferHeight = term.buffer.active.length;
                        const targetRows = Math.max(dims.rows, currentBufferHeight + 3);
                        term.resize(Math.floor(dims.cols), Math.floor(targetRows));
                    }
                } catch {
                    // Silently fail if fit is not possible
                }
            };

            // Use window resize instead of ResizeObserver to avoid terminal resize loops
            window.addEventListener('resize', handleResize);

            // Initial call
            setTimeout(handleResize, 100);

            term.writeln('\x1b[32mConnecting to container...\x1b[0m');

            // Start exec session and stream output
            try {
                const response = await fetch(`/api/docker/containers/${containerId}/exec`, {
                    signal: abortController.signal
                });

                if (!response.ok) {
                    throw new Error('Failed to start exec session');
                }

                // Extract session ID from header or first line
                sessionId = response.headers.get('x-session-id');

                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                // Send input to exec session
                term.onData(async (data) => {
                    if (!sessionId) return;

                    try {
                        await fetch(`/api/docker/containers/${containerId}/exec`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId, data })
                        });
                    } catch (err) {
                        console.error('Failed to send input:', err);
                    }
                });

                // Read output stream
                let sessionExtracted = false;
                while (isTerminalMounted) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    let chunk = decoder.decode(value, { stream: true });

                    // Extract and completely hide session ID from output
                    if (!sessionExtracted && chunk.includes('SESSION:')) {
                        sessionExtracted = true;
                        // Match SESSION:xxxxx and remove including newlines
                        const sessionMatch = chunk.match(/SESSION:([^\n\r]+)/);
                        if (sessionMatch) {
                            sessionId = sessionMatch[1].trim();
                            // Remove SESSION line and any trailing whitespace/newlines
                            chunk = chunk.replace(/SESSION:[^\n\r]+[\n\r]*/g, '');
                        }
                    }

                    // Write remaining output and scroll to bottom
                    if (chunk.length > 0) {
                        term.write(chunk);

                        // Dynamically grow the terminal height ONLY when a new line is added
                        const dims = fitAddon.proposeDimensions();
                        if (dims) {
                            const baseY = term.buffer.active.baseY;
                            if (baseY > 0) {
                                // Grow with +3 row buffer for visibility
                                term.resize(Math.floor(dims.cols), term.rows + baseY + 3);
                                term.refresh(0, term.rows - 1);
                            }
                        }

                        // Scroll the wrapper to the bottom of the terminal CONTENT
                        setTimeout(() => {
                            const wrapper = terminalRef.current?.parentElement;
                            const terminalContent = terminalRef.current;
                            if (wrapper && terminalContent) {
                                // Sticky scroll: keep prompt visible if user is at bottom (100px threshold)
                                const isAtBottom = wrapper.scrollTop + wrapper.clientHeight >= terminalContent.scrollHeight - 100;
                                if (isAtBottom) {
                                    wrapper.scrollTop = terminalContent.scrollHeight - wrapper.clientHeight;
                                }
                            }
                        }, 20);
                    }
                }

                term.writeln('');
                term.writeln('\x1b[31mConnection closed\x1b[0m');
            } catch (err: unknown) {
                const error = err as Error;
                if (error.name !== 'AbortError') {
                    console.error('Exec stream error:', error);
                    setError('Failed to connect to container terminal');
                    term.writeln('\x1b[31mConnection failed: ' + error.message + '\x1b[0m');
                }
            }

            return () => {
                isTerminalMounted = false;
                window.removeEventListener('resize', handleResize);
                abortController.abort();
                term.dispose();
            };
        }).catch(err => {
            console.error('Failed to load xterm:', err);
            setError('Failed to initialize terminal');
        });

        return () => {
            isTerminalMounted = false;
            abortController.abort();
        };
    }, [containerId, mounted]);

    if (!mounted) return null;

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        <div className={styles.statusDot} />
                        <h2 className={styles.title}>Terminal: {containerName}</h2>
                        <span className={styles.subtitle}>{containerId.slice(0, 12)}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div className={styles.error}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className={styles.terminalWrapper}>
                    <div ref={terminalRef} className={styles.terminal} />
                </div>
            </div>
        </div>,
        document.body
    );
}
