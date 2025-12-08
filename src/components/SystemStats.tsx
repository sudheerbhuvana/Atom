'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { SystemStats } from '@/types';
import styles from './SystemStats.module.css';

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function SystemStatsWidget() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [cpuHistory, setCpuHistory] = useState<number[]>(new Array(20).fill(0));

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/stats');
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                    setCpuHistory(prev => {
                        const newHistory = [...prev.slice(1), data.cpuLoad];
                        return newHistory;
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchStats();
        // Update every 5 seconds as requested
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    // Generate SVG path for the graph
    const getGraphPath = (data: number[], height: number, width: number) => {
        if (data.length === 0) return '';

        // Normalize data to fit height (0-100% -> height-0)
        // Invert Y because SVG 0 is top
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - (val / 100) * height;
            return `${x},${y}`;
        });

        // Simple straight lines
        return `M0,${height} L${points[0]} ` + points.slice(1).map(p => `L${p}`).join(' ') + ` L${width},${height} Z`;
    };

    const getLinePath = (data: number[], height: number, width: number) => {
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - (val / 100) * height;
            return `${x},${y}`;
        });
        return `M${points[0]} ` + points.slice(1).map(p => `L${p}`).join(' ');
    };

    if (!stats) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.card}>
            <div className={styles.cpuSection}>
                <div className={styles.cpuHeader}>
                    <div className={styles.label}><Cpu size={14} /> CPU</div>
                    <div className={styles.value}>{Math.round(stats.cpuLoad)}%</div>
                </div>

                <div className={styles.graphContainer}>
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={styles.graphSvg}>
                        <defs>
                            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#deb887" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#deb887" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d={getGraphPath(cpuHistory, 40, 100)} fill="url(#cpuGradient)" />
                        <path d={getLinePath(cpuHistory, 40, 100)} fill="none" stroke="#deb887" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>
            </div>

            <div className={styles.memSection}>
                <div className={styles.label}><MemoryStick size={14} /> Memory</div>
                <div className={styles.memRow}>
                    <span>RAM</span>
                    <span className={styles.memValue}>{formatBytes(stats.memUsed)} / {formatBytes(stats.memTotal)}</span>
                </div>
                <div className={styles.progressBar}>
                    <div className={styles.fill} style={{ width: `${(stats.memUsed / stats.memTotal) * 100}%` }} />
                </div>

                <div className={styles.memRow} style={{ marginTop: '0.5rem' }}>
                    <span>Stg</span>
                    <span className={styles.memValue}>{formatBytes(stats.storage[0].used)} / {formatBytes(stats.storage[0].size)}</span>
                </div>
                <div className={styles.progressBar}>
                    <div className={styles.fill} style={{ width: `${(stats.storage[0].used / stats.storage[0].size) * 100}%`, opacity: 0.5 }} />
                </div>
            </div>
        </div>
    );
}
