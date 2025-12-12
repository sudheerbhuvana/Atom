'use client';

import { X, Command, Search, Settings, Grid3X3, Grid2X2, List } from 'lucide-react';
import styles from './ShortcutsModal.module.css';

interface ShortcutsModalProps {
    onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
    const shortcuts = [
        { key: '/', description: 'Focus Search', icon: <Search size={16} /> },
        { key: 'S', description: 'Open Settings', icon: <Settings size={16} /> },
        { key: '1', description: 'Small Grid Layout', icon: <Grid3X3 size={16} /> },
        { key: '2', description: 'Large Grid Layout', icon: <Grid2X2 size={16} /> },
        { key: '3', description: 'List View', icon: <List size={16} /> },
        { key: 'Esc', description: 'Blur Search / Close Modal', icon: <X size={16} /> },
        { key: '?', description: 'Show Shortcuts', icon: <Command size={16} /> },
    ];

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Keyboard Shortcuts</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.grid}>
                    {shortcuts.map(s => (
                        <div key={s.key} className={styles.row}>
                            <div className={styles.description}>
                                <span className={styles.icon}>{s.icon}</span>
                                {s.description}
                            </div>
                            <div className={styles.key}>
                                {s.key}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
