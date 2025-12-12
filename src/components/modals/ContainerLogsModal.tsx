'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import styles from './ContainerLogsModal.module.css';

interface ContainerLogsModalProps {
    containerId: string;
    containerName: string;
    onClose: () => void;
}

export default function ContainerLogsModal({ containerId, containerName, onClose }: ContainerLogsModalProps) {
    const [logs, setLogs] = useState<string>('');
    const [autoScroll, setAutoScroll] = useState(true);
    const terminalRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Helper to strip ANSI codes (more comprehensive regex)
    const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const fetchLogs = async () => {
            try {
                const response = await fetch(`/api/docker/containers/${containerId}/logs`, {
                    signal: controller.signal
                });

                if (!response.body) return;

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (mounted) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    setLogs(prev => prev + stripAnsi(chunk));
                }
            } catch (error: unknown) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Log stream error:', error);
                    setLogs(prev => prev + '\n\n[Connection Error: ' + error.message + ']');
                }
            }
        };

        fetchLogs();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [containerId]);

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Manual scroll detection to disable auto-scroll
    const handleScroll = () => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        // If user scrolled up a bit (allow 50px buffer), disable auto-scroll
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        if (!isAtBottom && autoScroll) {
            setAutoScroll(false);
        } else if (isAtBottom && !autoScroll) {
            setAutoScroll(true);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <TerminalIcon size={16} />
                        root@{containerName}:/app# logs -f
                        <div className={styles.statusIndicator} title="Connected" />
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <div
                    className={styles.terminal}
                    ref={terminalRef}
                    onScroll={handleScroll}
                >
                    {logs || <span style={{ opacity: 0.5 }}>Connecting to container stream...</span>}
                </div>

                <div className={styles.controls}>
                    <span>{logs.length} chars</span>
                    <button
                        className={`${styles.autoScrollBtn} ${autoScroll ? styles.active : ''}`}
                        onClick={() => setAutoScroll(!autoScroll)}
                    >
                        {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
                    </button>
                </div>
            </div>
        </div>
    );
}
