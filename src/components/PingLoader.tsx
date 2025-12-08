import styles from './PingLoader.module.css';

interface PingLoaderProps {
    className?: string;
}

export default function PingLoader({ className }: PingLoaderProps) {
    return (
        <div className={`${styles.loader} ${className || ''}`} title="Pinging...">
            <div className={styles.pulseRing}></div>
        </div>
    );
}
