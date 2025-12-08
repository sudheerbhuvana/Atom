'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from 'lucide-react';
import { DockerContainer } from '@/types';
import styles from './DockerWidget.module.css';

export default function DockerWidget() {
    const [stats, setStats] = useState<{ running: number; total: number; cpu: number; mem: number } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/docker');
                if (res.ok) {
                    const containers: DockerContainer[] = await res.json();
                    const running = containers.filter(c => c.state === 'running').length;

                    // Aggregate resource usage
                    const totalCpu = containers.reduce((acc, c) => acc + (c.cpu || 0), 0);
                    const totalMem = containers.reduce((acc, c) => acc + (c.memPercent || 0), 0);

                    setStats({
                        running,
                        total: containers.length,
                        cpu: Math.round(totalCpu),
                        mem: Math.round(totalMem)
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchStats();
        // Poll less frequently for the widget
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return null; // Or partial loading state

    return (
        <Link href="/docker" className={styles.widget}>
            <div className={styles.header}>
                <Box size={20} className={styles.icon} />
                <span>Docker</span>
            </div>

            <div className={styles.statsRow}>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{ color: '#22c55e' }}>{stats.running}</span>
                    <span className={styles.statLabel}>Running</span>
                </div>

                <div className={styles.divider} />

                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.total}</span>
                    <span className={styles.statLabel}>Total</span>
                </div>

                <div className={styles.divider} />

                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.cpu}%</span>
                    <span className={styles.statLabel}>CPU Agg</span>
                </div>
            </div>
        </Link>
    );
}
