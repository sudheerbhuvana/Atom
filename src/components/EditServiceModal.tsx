'use client';

import { useState } from 'react';
import { X, ArrowUpDown, Trash2, Edit3 } from 'lucide-react';
import { Service } from '@/types';
import * as simpleIcons from 'simple-icons';
import styles from './EditServiceModal.module.css';

interface EditServiceModalProps {
    services: Service[];
    onClose: () => void;
    onDelete: (ids: string[]) => void;
    onEdit?: (service: Service) => void;
    title?: string;
}

export default function EditServiceModal({ services, onClose, onDelete, onEdit, title = "Applications" }: EditServiceModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        const newAn = new Set(selectedIds);
        if (newAn.has(id)) newAn.delete(id);
        else newAn.add(id);
        setSelectedIds(newAn);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredServices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredServices.map(s => s.id)));
        }
    };

    const handleDelete = () => {
        onDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
    };

    const formatDate = (ts?: number) => {
        if (!ts) return new Date().toLocaleString(); // Fallback for demo
        return new Date(ts).toLocaleString();
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>Edit {title}</h2>
                        <p className={styles.subHeader}>Edit your {title.toLowerCase()} here.</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>

                <div className={styles.toolbar}>
                    <input
                        className={styles.searchBar}
                        placeholder="Search by title..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {selectedIds.size > 0 && (
                        <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
                    )}
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredServices.length > 0 && selectedIds.size === filteredServices.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ textAlign: 'center', width: 60 }}>Icon</th>
                                <th>Title <ArrowUpDown size={12} /></th>
                                <th>URL</th>
                                <th>Updated <ArrowUpDown size={12} /></th>
                                {onEdit && <th style={{ width: 50 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredServices.map(s => {
                                // Render Icon
                                let IconPath = null;
                                if (s.icon) {
                                    const slug = 'si' + s.icon.charAt(0).toUpperCase() + s.icon.slice(1);
                                    // @ts-ignore
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
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d={IconPath} /></svg>
                                                ) : (
                                                    <div className={styles.noIcon}>-</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>{s.name}</td>
                                        <td className={styles.urlCell}>{s.url}</td>
                                        <td className={styles.dateCell}>{formatDate(s.updatedAt)}</td>
                                        {onEdit && (
                                            <td>
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => onEdit(s)}
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredServices.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#555' }}>No results found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={styles.footer}>
                    <span>{selectedIds.size} of {filteredServices.length} row(s) selected.</span>
                    <div className={styles.pagination}>
                        <button disabled className={styles.pageBtn}>Previous</button>
                        <button disabled className={styles.pageBtn}>Next</button>
                    </div>
                </div>

            </div>
        </div>
    );
}
