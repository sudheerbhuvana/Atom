'use client';


import { motion } from 'framer-motion';
import { Box, ArrowUpRight } from 'lucide-react';
import { Service } from '@/types';
import { useStatus } from '@/context/StatusContext';
import PingLoader from './PingLoader';
import * as simpleIcons from 'simple-icons';
import styles from './ServiceCard.module.css';

interface ServiceCardProps {
    service: Service;
    compact?: boolean;
}

export default function ServiceCard({ service, compact = false }: ServiceCardProps) {
    let IconPath = null;

    if (service.icon) {
        const slug = 'si' + service.icon.charAt(0).toUpperCase() + service.icon.slice(1);
        // @ts-expect-error SimpleIcons indexing by string key
        const iconData = simpleIcons[slug];
        if (iconData) {
            IconPath = iconData.path;
        }
    }

    const { statuses } = useStatus();

    // Derived visual state
    // If we have no data at all (first load) OR the context explicitly says loading
    // We treat 'loading' state as the source of truth for showing the loader.
    const status = statuses[service.id || service.url] || { state: 'loading', code: 0, latency: 0, lastUpdated: 0 };
    const isActuallyLoading = status.state === 'loading';

    // Removed useEffect for auto-check - handled by Dashboard now



    return (
        <motion.a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.card} ${compact ? styles.compact : ''}`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            title={compact ? `${service.name} - ${service.url}` : undefined}
        >
            <div className={styles.iconContainer}>
                {IconPath ? (
                    <svg
                        role="img"
                        viewBox="0 0 24 24"
                        className={styles.svgIcon}
                    >
                        <path d={IconPath} />
                    </svg>
                ) : (
                    <Box size={24} />
                )}
                {/* Status Indicator (Only for Apps) */}
                {service.category !== 'Bookmark' && (
                    <>
                        {isActuallyLoading ? (
                            <PingLoader className={styles.statusLoader} />
                        ) : (
                            <div className={`${styles.statusDot} ${styles[status.state]}`} title={`Status: ${status.state.toUpperCase()} ${status.code ? `(${status.code})` : ''} - ${status.latency}ms`} />
                        )}
                    </>
                )}
            </div>
            {!compact && (
                <div className={styles.info}>
                    <div className={styles.nameRow}>
                        <span className={styles.name}>{service.name}</span>
                    </div>
                    <div className={styles.url}>
                        {(status.state === 'down' && status.code > 0) ? (
                            <span className={styles.errorCode}>Err {status.code}</span>
                        ) : (
                            <>
                                <ArrowUpRight size={12} />
                                {service.url.replace(/^https?:\/\//, '')}
                            </>
                        )}
                    </div>
                </div>
            )}
        </motion.a>
    );
}
