'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Terminal, Play, Square, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DockerContainer } from '@/types';
import ContainerLogsModal from '@/components/modals/ContainerLogsModal';
import styles from './page.module.css';

export default function DockerDashboard() {
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [viewingLogsFor, setViewingLogsFor] = useState<{ id: string, name: string } | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const fetchContainers = async () => {
        try {
            const res = await fetch('/api/docker/containers');
            if (res.ok) {
                const data = await res.json();

                // Smart Merge: Keep old stats if new ones failed (prevent flickering to 0%)
                setContainers(prev => {
                    return data.containers.map((newC: DockerContainer) => {
                        const oldC = prev.find(p => p.id === newC.id);

                        // If we have an old container, and the new one has "empty" stats (timeout), 
                        // but is still running, keep the old stats to prevent UI jumping.
                        // Backend returns 'memory: -' on stats error.
                        if (oldC && newC.state === 'running' && newC.memory === '-' && oldC.memory !== '-') {
                            return {
                                ...newC,
                                cpu: oldC.cpu,
                                memory: oldC.memory,
                                memPercent: oldC.memPercent
                            };
                        }
                        return newC;
                    });
                });

                setError(null);
                setLastUpdated(new Date());
            } else {
                const data = await res.json();
                setError(data.hint || data.details || 'Failed to connect to Docker API');
                // Don't clear containers if just a transient error? 
                // Actually, if we can't connect, we probably shouldn't show stale state for too long, 
                // but for now let's keep it simple.
            }
        } catch (e) {
            console.error('Failed to fetch containers:', e);
            setError('Is Docker running? Failed to reach backend API.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 3000);
        return () => clearInterval(interval);
    }, []);

    // ... (keep handleAction and getUsageColor same)

    // Re-declare them here for the replace block context if needed, 
    // but better to just use the existing ones if not replacing the whole function.
    // The tool says "ReplacementContent" must replace 'targetContent'.
    // I will replace the whole component body/return to be safe and include the error UI.

    const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
        setProcessing(id);
        const loadingToast = toast.loading(`${action === 'start' ? 'Starting' : action === 'restart' ? 'Restarting' : 'Stopping'} container...`);

        try {
            const res = await fetch(`/api/docker/containers/${id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.details || 'Action failed');

            toast.success(data.message);
            fetchContainers(); // Immediate refresh
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'An error occurred';
            toast.error(errorMsg);
        } finally {
            setProcessing(null);
            toast.dismiss(loadingToast);
        }
    };

    const getUsageColor = (percent: number) => {
        if (percent > 80) return styles.high;
        if (percent > 50) return styles.med;
        return styles.low;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Docker Containers</h1>
                    <div className={styles.subtitle}>
                        {error ? (
                            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Connection Error
                            </span>
                        ) : (
                            <>{containers.length} Containers • Updated {lastUpdated.toLocaleTimeString()}</>
                        )}
                    </div>
                </div>
                <Link href="/" className={styles.backBtn}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </header>

            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <div style={{ flex: 1 }}>
                        <strong>Docker Connection Failed</strong>
                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{error}</div>
                    </div>
                </div>
            )}

            <div className={styles.card}>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name / Image</th>
                                <th>Status</th>
                                <th>CPU</th>
                                <th>Memory</th>
                                <th>Ports</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && containers.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className={styles.loading}>Loading containers...</div>
                                    </td>
                                </tr>
                            ) : containers.map(container => (
                                <tr key={container.id}>
                                    <td>
                                        <div className={styles.containerName}>{container.name}</div>
                                        <div className={styles.containerImage}>{container.image}</div>
                                    </td>
                                    <td>
                                        <div>
                                            <span
                                                className={`${styles.statusDot} ${container.state === 'running' ? styles.statusRunning :
                                                    container.state === 'exited' ? styles.statusExited : styles.statusPaused
                                                    }`}
                                            />
                                            {container.state}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {container.status}
                                        </div>
                                    </td>
                                    <td>
                                        <div>{container.cpu?.toFixed(1) || '0.0'}%</div>
                                        <div className={styles.usageBar}>
                                            <div
                                                className={`${styles.usageFill} ${getUsageColor(container.cpu || 0)}`}
                                                style={{ width: `${Math.min(container.cpu || 0, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td>
                                        <div>{container.memory || '-'}</div>
                                        <div className={styles.usageBar}>
                                            <div
                                                className={`${styles.usageFill} ${getUsageColor(container.memPercent || 0)}`}
                                                style={{ width: `${Math.min(container.memPercent || 0, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className={styles.ports}>
                                        {container.ports || '-'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {/* Logs Button - Only if running */}
                                            {container.state === 'running' && (
                                                <button
                                                    className={styles.pactionBtn}
                                                    onClick={() => setViewingLogsFor({ id: container.id, name: container.name })}
                                                    title="View Logs"
                                                    disabled={!!processing}
                                                >
                                                    <Terminal size={16} />
                                                </button>
                                            )}

                                            {/* Power Actions */}
                                            {container.state === 'running' ? (
                                                <>
                                                    <button
                                                        className={`${styles.pactionBtn} ${styles.btnRestart}`}
                                                        onClick={() => handleAction(container.id, 'restart')}
                                                        title="Restart"
                                                        disabled={!!processing}
                                                    >
                                                        <RotateCw size={16} className={processing === container.id ? styles.spin : ''} />
                                                    </button>
                                                    <button
                                                        className={`${styles.pactionBtn} ${styles.btnStop}`}
                                                        onClick={() => handleAction(container.id, 'stop')}
                                                        title="Stop"
                                                        disabled={!!processing}
                                                    >
                                                        <Square size={16} fill="currentColor" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className={`${styles.pactionBtn} ${styles.btnStart}`}
                                                    onClick={() => handleAction(container.id, 'start')}
                                                    title="Start"
                                                    disabled={!!processing}
                                                >
                                                    <Play size={16} fill="currentColor" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && containers.length === 0 && !error && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                        No containers found.
                                    </td>
                                </tr>
                            )}
                            {!loading && error && containers.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
                                        Check Docker connection.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {viewingLogsFor && (
                <ContainerLogsModal
                    containerId={viewingLogsFor.id}
                    containerName={viewingLogsFor.name}
                    onClose={() => setViewingLogsFor(null)}
                />
            )}
        </div>
    );
}
