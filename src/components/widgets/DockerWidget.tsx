'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, ArrowUpRight } from 'lucide-react';
import styles from './DockerWidget.module.css';

interface SimpleContainer {
    id: string;
    state: string; // running, exited
    status: string;
}

export default function DockerWidget() {
    const [stats, setStats] = useState<{ running: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/docker/containers');
                if (res.ok) {
                    const data = await res.json();
                    const containers: SimpleContainer[] = data.containers;
                    const running = containers.filter(c => c.state === 'running').length;

                    setStats({
                        running,
                        total: containers.length
                    });
                    setError(null);
                } else {
                    const data = await res.json();
                    setError(data.error || 'Failed to fetch');
                }
            } catch (e) {
                console.error(e);
                setError('Network Error');
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (error) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <Box size={20} className={styles.icon} />
                    <span>Docker</span>
                </div>
                <div className="text-red-500 text-sm">{error}</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <Box size={20} className={styles.icon} />
                    <span>Docker</span>
                </div>
                <div className="animate-pulse text-sm text-gray-400">Loading...</div>
            </div>
        );
    }

    return (
        <Link href="/docker" className={styles.widget}>
            <div className={styles.leftSection}>
                <div className={styles.iconBox}>
                    <Box size={20} />
                </div>
                <div className={styles.meta}>
                    <span className={styles.title}>Docker</span>
                    <span className={styles.subtitle}>{stats.total} Containers</span>
                </div>
            </div>

            <div className={styles.statsSection}>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{ color: '#22c55e' }}>{stats.running}</span>
                    <span className={styles.statLabel}>Running</span>
                </div>
                <ArrowUpRight size={16} className={styles.arrow} />
            </div>
        </Link>
    );
}
