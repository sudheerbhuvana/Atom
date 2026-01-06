'use client';

import { useState } from 'react';
import { ArrowUpDown, Edit3, Trash2 } from 'lucide-react';
import { Service } from '@/types';
import * as simpleIcons from 'simple-icons';
import styles from './EditableTable.module.css';

interface EditableTableProps {
    items: Service[];
    onDelete: (ids: string[]) => void;
    onEdit: (item: Service) => void;
    title?: string;
}

export default function EditableTable({ items, onDelete, onEdit, title = "Items" }: EditableTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    const filteredItems = items.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(s => s.id)));
        }
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
            onDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const formatDate = (ts?: number) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleDateString();
    };

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <input
                    className={styles.searchBar}
                    placeholder={`Search ${title.toLowerCase()}...`}
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
                                    checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th style={{ textAlign: 'center', width: 60 }}>Icon</th>
                            <th>Title <ArrowUpDown size={12} /></th>
                            <th>URL</th>
                            <th>Updated</th>
                            <th style={{ width: 50 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.map(s => {
                            // Render Icon
                            let IconPath = null;
                            if (s.icon) {
                                const slug = 'si' + s.icon.charAt(0).toUpperCase() + s.icon.slice(1);
                                // @ts-expect-error SimpleIcons indexing by string key
                                const iconData = simpleIcons[slug];
                                if (iconData) IconPath = iconData.path;
                            }

                            return (
                                <tr key={s.id} className={selectedIds.has(s.id) ? styles.selectedRow : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(s.id)}
                                            onChange={() => toggleSelect(s.id)}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={styles.iconPreview}>
                                            {IconPath ? (
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d={IconPath} /></svg>
                                            ) : (
                                                <div className={styles.noIcon}>-</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className={styles.titleCell}>
                                        <div className={styles.titleText}>{s.name}</div>
                                        {s.description && <div className={styles.subtitle}>{s.description}</div>}
                                    </td>
                                    <td className={styles.urlCell}>
                                        <a href={s.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                                            {s.url}
                                        </a>
                                    </td>
                                    <td className={styles.dateCell}>{formatDate(s.updatedAt)}</td>
                                    <td>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => onEdit(s)}
                                            title="Edit"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No {title.toLowerCase()} found matching "{search}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.footer}>
                <span>Showing {filteredItems.length} of {items.length} items</span>
            </div>
        </div>
    );
}
