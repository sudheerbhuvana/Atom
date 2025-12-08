'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DockerContainer } from '@/types';
import styles from './page.module.css';

export default function DockerDashboard() {
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchContainers = async () => {
        try {
            const res = await fetch('/api/docker');
            if (res.ok) {
                const data = await res.json();
                setContainers(data);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error('Failed to fetch docker stats', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 3000);
        return () => clearInterval(interval);
    }, []);

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
                        {containers.length} Containers • Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                </div>
                <Link href="/" className={styles.backBtn}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </header>

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
                            </tr>
                        </thead>
                        <tbody>
                            {loading && containers.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
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
                                        <div>{container.cpu}%</div>
                                        <div className={styles.usageBar}>
                                            <div
                                                className={`${styles.usageFill} ${getUsageColor(container.cpu)}`}
                                                style={{ width: `${Math.min(container.cpu, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td>
                                        <div>{container.memory}</div>
                                        <div className={styles.usageBar}>
                                            <div
                                                className={`${styles.usageFill} ${getUsageColor(container.memPercent)}`}
                                                style={{ width: `${Math.min(container.memPercent, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className={styles.ports}>
                                        {container.ports || '-'}
                                    </td>
                                </tr>
                            ))}
                            {!loading && containers.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                                        No containers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
