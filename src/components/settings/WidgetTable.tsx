'use client';

import { useState } from 'react';
import { ArrowUpDown, Edit3, Trash2 } from 'lucide-react';
import { Widget } from '@/types';
import styles from './EditableTable.module.css'; // Reusing styles

interface WidgetTableProps {
    widgets: Widget[];
    onDelete: (ids: string[]) => void;
    onEdit: (widget: Widget) => void;
}

export default function WidgetTable({ widgets, onDelete, onEdit }: WidgetTableProps) {
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
        if (confirm(`Are you sure you want to delete ${selectedIds.size} widgets?`)) {
            onDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const renderDetails = (w: Widget) => {
        if (w.type === 'generic') return (w.options as { endpoint?: string })?.endpoint || '-';
        // Safely handle options as object or string
        const opts = w.options || {};
        try {
            return JSON.stringify(opts).slice(0, 50) + (JSON.stringify(opts).length > 50 ? '...' : '');
        } catch {
            return '-';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <input
                    className={styles.searchBar}
                    placeholder="Search widgets..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {selectedIds.size > 0 && (
                    <button className={styles.deleteBtn} onClick={handleDelete}>
                        <Trash2 size={16} /> Delete Selected ({selectedIds.size})
                    </button>
                )}
            </div>

            <div className={styles.tableWrapper}>
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
                                <td className={styles.titleText}>{w.title}</td>
                                <td><span style={{ padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '0.8rem' }}>{w.type}</span></td>
                                <td className={styles.urlCell}>
                                    {renderDetails(w)}
                                </td>
                                <td>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => onEdit(w)}
                                        title="Edit"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredWidgets.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No widgets found matching &quot;{search}&quot;
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.footer}>
                <span>Showing {filteredWidgets.length} of {widgets.length} widgets</span>
            </div>
        </div>
    );
}
