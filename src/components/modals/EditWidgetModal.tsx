'use client';

import { useState } from 'react';
import { X, ArrowUpDown, Edit3 } from 'lucide-react';
import { Widget } from '@/types';
import styles from './EditWidgetModal.module.css';

interface EditWidgetModalProps {
    widgets: Widget[];
    onClose: () => void;
    onDelete: (ids: string[]) => void;
    onEdit: (widget: Widget) => void;
}

export default function EditWidgetModal({ widgets, onClose, onDelete, onEdit }: EditWidgetModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    const filteredWidgets = widgets.filter(w =>
        (w.title || '').toLowerCase().includes(search.toLowerCase()) ||
        w.type.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredWidgets.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredWidgets.map(w => w.id)));
        }
    };

    const handleDelete = () => {
        onDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>Edit Widgets</h2>
                        <p className={styles.subHeader}>Manage your dashboard widgets.</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>

                <div className={styles.toolbar}>
                    <input
                        className={styles.searchBar}
                        placeholder="Search widgets..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {selectedIds.size > 0 && (
                        <button className={styles.deleteBtn} onClick={handleDelete}>Delete Selected</button>
                    )}
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredWidgets.length > 0 && selectedIds.size === filteredWidgets.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th>Title <ArrowUpDown size={12} /></th>
                                <th>Type</th>
                                <th>Details</th>
                                <th style={{ width: 50 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWidgets.map(w => (
                                <tr key={w.id} className={selectedIds.has(w.id) ? styles.selectedRow : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(w.id)}
                                            onChange={() => toggleSelect(w.id)}
                                        />
                                    </td>
                                    <td>{w.title}</td>
                                    <td><span className={styles.typeBadge}>{w.type}</span></td>
                                    <td className={styles.urlCell}>
                                        {w.type === 'generic' ? ((w.options as { endpoint?: string })?.endpoint || '-') : JSON.stringify(w.options || {})}
                                    </td>
                                    <td>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => onEdit(w)}
                                            title="Edit Widget"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredWidgets.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#555' }}>No widgets found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={styles.footer}>
                    <span>{selectedIds.size} of {filteredWidgets.length} loaded.</span>
                </div>

            </div>
        </div>
    );
}
