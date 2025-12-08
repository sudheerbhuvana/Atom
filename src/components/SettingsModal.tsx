'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Save, Edit3, Settings as SettingsIcon } from 'lucide-react';
import { AppConfig, Service } from '@/types';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    onUpdate: (newConfig: AppConfig) => void;
}

export default function SettingsModal({ isOpen, onClose, config, onUpdate }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'services' | 'general'>('services');
    const [localConfig, setLocalConfig] = useState<AppConfig>(config);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

    // Handlers for Services
    const handleServiceChange = (id: string, field: keyof Service, value: string) => {
        setLocalConfig(prev => ({
            ...prev,
            services: prev.services.map(s => s.id === id ? { ...s, [field]: value } : s)
        }));
    };

    const traverseAddService = () => {
        const newService: Service = {
            id: Date.now().toString(),
            name: 'New Service',
            url: 'https://',
            category: 'Default'
        };
        setLocalConfig(prev => ({
            ...prev,
            services: [...prev.services, newService]
        }));
        setEditingServiceId(newService.id);
    };

    const handleDeleteService = (id: string) => {
        if (confirm('Delete this service?')) {
            setLocalConfig(prev => ({
                ...prev,
                services: prev.services.filter(s => s.id !== id)
            }));
        }
    };

    // Handlers for General Settings
    const handleGeneralChange = (field: string, value: any) => {
        if (field === 'columns') {
            setLocalConfig(prev => ({
                ...prev,
                layout: { ...prev.layout, columns: parseInt(value) || 3 }
            }));
        } else {
            setLocalConfig(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSave = async () => {
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localConfig)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    onUpdate(localConfig);
                    onClose();
                }
            }
        } catch (e) {
            console.error('Failed to save settings', e);
            alert('Failed to save settings');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className={styles.modal}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    <div className={styles.header}>
                        <h2><SettingsIcon size={20} /> Configuration</h2>
                        <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                    </div>

                    <div className={styles.tabs}>
                        <button
                            className={activeTab === 'services' ? styles.activeTab : ''}
                            onClick={() => setActiveTab('services')}
                        >
                            Services
                        </button>
                        <button
                            className={activeTab === 'general' ? styles.activeTab : ''}
                            onClick={() => setActiveTab('general')}
                        >
                            General
                        </button>
                    </div>

                    <div className={styles.body}>
                        {activeTab === 'services' ? (
                            <div className={styles.serviceList}>
                                {localConfig.services.map(service => (
                                    <div key={service.id} className={styles.serviceItem}>
                                        {editingServiceId === service.id ? (
                                            <div className={styles.editForm}>
                                                <input
                                                    value={service.name}
                                                    onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                                                    placeholder="Name"
                                                />
                                                <input
                                                    value={service.url}
                                                    onChange={(e) => handleServiceChange(service.id, 'url', e.target.value)}
                                                    placeholder="URL"
                                                />
                                                <input
                                                    value={service.icon || ''}
                                                    onChange={(e) => handleServiceChange(service.id, 'icon', e.target.value)}
                                                    placeholder="Icon slug (e.g. plex)"
                                                />
                                                <input
                                                    value={service.category}
                                                    onChange={(e) => handleServiceChange(service.id, 'category', e.target.value)}
                                                    placeholder="Category (Network, Media...)"
                                                />
                                                <button onClick={() => setEditingServiceId(null)} className={styles.doneBtn}><Save size={14} /> Done</button>
                                            </div>
                                        ) : (
                                            <div className={styles.serviceView}>
                                                <span>{service.name}</span>
                                                <div className={styles.actions}>
                                                    <button onClick={() => setEditingServiceId(service.id)}><Edit3 size={14} /></button>
                                                    <button onClick={() => handleDeleteService(service.id)} className={styles.deleteBtn}><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button onClick={traverseAddService} className={styles.addBtn}>
                                    <Plus size={16} /> Add Service
                                </button>
                            </div>
                        ) : (
                            <div className={styles.generalForm}>
                                <label>
                                    Page Title
                                    <input
                                        value={localConfig.title}
                                        onChange={(e) => handleGeneralChange('title', e.target.value)}
                                    />
                                </label>
                                <label>
                                    Grid Columns
                                    <input
                                        type="number"
                                        min="1"
                                        max="6"
                                        value={localConfig.layout.columns}
                                        onChange={(e) => handleGeneralChange('columns', e.target.value)}
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className={styles.footer}>
                        <button onClick={handleSave} className={styles.saveBtn}>Save Changes</button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
