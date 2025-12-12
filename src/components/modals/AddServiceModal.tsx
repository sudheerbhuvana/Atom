'use client';

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import * as simpleIcons from 'simple-icons';
import { toast } from 'sonner';
import { Service } from '@/types';
import styles from './AddServiceModal.module.css';

// Pre-compute minimal icon list for performance
const ALL_ICONS = Object.values(simpleIcons).map(icon => ({
    title: icon.title,
    slug: icon.slug,
    path: icon.path,
    hex: icon.hex
}));

interface AddServiceModalProps {
    onClose: () => void;
    onSave: (service: Service) => void;
    category?: string; // 'Applications' or 'Bookmarks'
    initialData?: Service | null;
}

export default function AddServiceModal({ onClose, onSave, category = 'General', initialData }: AddServiceModalProps) {
    const [formData, setFormData] = useState<Partial<Service>>({
        name: initialData?.name || '',
        url: initialData?.url || '',
        description: initialData?.description || '',
        icon: initialData?.icon || '',
        category: initialData?.category || category
    });
    const [iconQuery, setIconQuery] = useState('');

    const filteredIcons = iconQuery
        ? ALL_ICONS.filter(icon =>
            icon.title.toLowerCase().includes(iconQuery.toLowerCase()) ||
            icon.slug.toLowerCase().includes(iconQuery.toLowerCase())
        ).slice(0, 20)
        : ALL_ICONS.slice(0, 20); // Show top 20 initially

    const handleSubmit = (addNew: boolean) => {
        if (!formData.name || !formData.url) {
            toast.error('Title and URL are required');
            return;
        }

        // Create new service object
        const newService: Service = {
            id: initialData?.id || Date.now().toString(),
            name: formData.name,
            url: formData.url,
            description: formData.description,
            icon: formData.icon || 'box',
            category: formData.category,
            createdAt: initialData?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        onSave(newService);

        if (addNew) {
            // Reset form but keep category
            setFormData({
                name: '',
                url: '',
                description: '',
                icon: '',
                category
            });
            setIconQuery('');
        } else {
            onClose();
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>{initialData ? 'Edit' : 'Add'} {category === 'Bookmarks' ? 'Bookmark' : 'Application'}</h2>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>
                <div className={styles.subHeader}>Add a new application to Atom.</div>

                <div className={styles.body}>
                    <div className={styles.field}>
                        <label>Title</label>
                        <input
                            autoFocus
                            placeholder="e.g. Proxmox"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>URL</label>
                        <input
                            placeholder="http://10.0.0.1:8006"
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Description</label>
                        <textarea
                            rows={3}
                            placeholder="Optional description of the application."
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                        <span className={styles.hint}>Optional description of the application.</span>
                    </div>

                    <div className={styles.field}>
                        <label>Icon</label>
                        <div className={styles.iconSearch}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                placeholder="Search icons (e.g. proxmox, home assistant)"
                                value={iconQuery}
                                onChange={e => setIconQuery(e.target.value)}
                            />
                        </div>
                        <div className={styles.iconGrid}>
                            {filteredIcons.map(icon => (
                                <button
                                    key={icon.slug}
                                    className={`${styles.iconBtn} ${formData.icon === icon.slug ? styles.selected : ''}`}
                                    onClick={() => setFormData({ ...formData, icon: icon.slug })}
                                    title={icon.title}
                                >
                                    <svg viewBox="0 0 24 24" className={styles.svg}>
                                        <path d={icon.path} fill="currentColor" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <div className={styles.actions}>
                        <button className={styles.secondaryBtn} onClick={() => handleSubmit(true)}>Save & Add New</button>
                        <button className={styles.primaryBtn} onClick={() => handleSubmit(false)}>Save</button>
                    </div>
                </div>

            </div>
        </div>
    );
}
