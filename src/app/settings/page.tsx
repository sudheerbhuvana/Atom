'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, Download, Trash2, Edit3, Plus, Sun, Moon, Code, X } from 'lucide-react';
import { toast } from 'sonner';
import { Service, Link as AppLink, Widget } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import AddServiceModal from '@/components/modals/AddServiceModal';
import EditServiceModal from '@/components/modals/EditServiceModal';
import AddWidgetModal from '@/components/modals/AddWidgetModal';
import EditWidgetModal from '@/components/modals/EditWidgetModal';
import UserManagement from '@/components/ui/UserManagement';
import { useConfig } from '@/context/ConfigContext';
import styles from './page.module.css';

export default function SettingsPage() {
    const { theme, toggleTheme } = useTheme();
    const { config, updateConfig, loading } = useConfig();
    const [activeModal, setActiveModal] = useState<'add-app' | 'edit-app' | 'add-link' | 'edit-link' | 'config' | 'add-widget' | 'edit-widget' | null>(null);
    const [configJson, setConfigJson] = useState('');
    const [editingItem, setEditingItem] = useState<Service | null>(null);
    const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
    const [localTitle, setLocalTitle] = useState('');
    const [localLocation, setLocalLocation] = useState('');

    useEffect(() => {
        if (config) {
            setLocalTitle(config.title || '');
            setLocalLocation(config.weather?.location || '');
        }
    }, [config]);

    const updateLayout = (key: string, value: string | number | boolean) => {
        if (!config) return;
        updateConfig({
            ...config,
            layout: { ...config.layout, [key]: value }
        });
    };

    const handleAddService = (service: Service) => {
        if (!config) return;

        // Check if updating existing
        const exists = config.services.some(s => s.id === service.id);
        let newServices;

        if (exists) {
            newServices = config.services.map(s => s.id === service.id ? service : s);
        } else {
            newServices = [...config.services, service];
        }

        updateConfig({
            ...config,
            services: newServices
        });
        setEditingItem(null);
    };

    const handleDeleteServices = (ids: string[]) => {
        if (!config) return;
        updateConfig({
            ...config,
            services: config.services.filter(s => !ids.includes(s.id))
        });
        setActiveModal(null);
    };

    const handleDeleteAllServices = () => {
        if (!config) return;
        toast('Delete ALL applications?', {
            action: {
                label: 'Delete',
                onClick: () => updateConfig({ ...config, services: [] })
            },
            cancel: { label: 'Cancel', onClick: () => { } }
        });
    };

    // Adapting Links to Service interface for the EditModal
    const linkToService = (l: AppLink): Service => ({
        id: l.id,
        name: l.title,
        url: l.url,
        icon: l.icon
    });

    const handleAddLink = (service: Service) => {
        if (!config) return;

        const newLink: AppLink = {
            id: service.id,
            title: service.name,
            url: service.url,
            icon: service.icon
        };

        // Check if updating existing
        const exists = config.links.some(l => l.id === newLink.id);
        let newLinks;

        if (exists) {
            newLinks = config.links.map(l => l.id === newLink.id ? newLink : l);
        } else {
            newLinks = [...config.links, newLink];
        }

        updateConfig({
            ...config,
            links: newLinks
        });
        setEditingItem(null);
    };

    const handleDeleteLinks = (ids: string[]) => {
        if (!config) return;
        updateConfig({
            ...config,
            links: config.links.filter(l => !ids.includes(l.id))
        });
        setActiveModal(null);
    };
    const handleDeleteAllLinks = () => {
        if (!config) return;
        toast('Delete ALL bookmarks?', {
            action: {
                label: 'Delete',
                onClick: () => updateConfig({ ...config, links: [] })
            },
            cancel: { label: 'Cancel', onClick: () => { } }
        });
    };

    const handleExport = () => {
        if (!config) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "atom-config.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (json.services) {
                    updateConfig(json);
                    toast.success('Configuration imported successfully');
                }
            } catch { toast.error('Invalid JSON configuration file'); }
        };
        reader.readAsText(file);
    };

    if (loading || !config) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.wrapper}>
            <header className={styles.header}>
                <h1>Settings</h1>
                <div className={styles.headerActions}>
                    <button
                        onClick={() => {
                            const newMode = theme === 'dark' ? 'light' : 'dark';
                            toggleTheme();
                            if (config) {
                                updateConfig({
                                    ...config,
                                    theme: { ...config.theme, mode: newMode }
                                });
                            }
                        }}
                        className={styles.themeToggle}
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <Link href="/" className={styles.backBtn}> <ArrowLeft size={16} /> Back</Link>
                </div>
            </header>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>General</h2>
                <p className={styles.sectionDesc}>Show or hide widgets on your dashboard.</p>

                <div className={styles.controlRow}>
                    <label>Show Widgets</label>
                    <div
                        className={`${styles.toggle} ${config.layout?.showWidgets ? styles.active : ''}`}
                        onClick={() => updateLayout('showWidgets', !config.layout?.showWidgets)}
                    >
                        <div className={styles.thumb} />
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <label>Dashboard Title</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            className={styles.input}
                            value={localTitle}
                            onChange={(e) => setLocalTitle(e.target.value)}
                            placeholder="Dashboard Title"
                        />
                        <button
                            className={styles.btnPrimary}
                            onClick={() => {
                                if (config) {
                                    updateConfig({ ...config, title: localTitle });
                                    toast.success('Dashboard Title saved');
                                }
                            }}
                            title="Save Title"
                        >
                            <Save size={16} />
                        </button>
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <label>Weather Location</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            className={styles.input}
                            value={localLocation}
                            onChange={(e) => setLocalLocation(e.target.value)}
                            placeholder="City (e.g. Hyderabad)"
                        />
                        <button
                            className={styles.btnPrimary}
                            onClick={() => {
                                if (config) {
                                    updateConfig({
                                        ...config,
                                        weather: { ...config.weather, location: localLocation }
                                    });
                                    toast.success('Weather Location saved');
                                }
                            }}
                            title="Save Location"
                        >
                            <Save size={16} />
                        </button>
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <label>Default Search</label>
                    <select
                        className={styles.select}
                        value={config.searchEngine || 'Google'}
                        onChange={(e) => updateConfig({ ...config, searchEngine: e.target.value })}
                    >
                        <option value="Google">Google</option>
                        <option value="DuckDuckGo">DuckDuckGo</option>
                        <option value="Bing">Bing</option>
                    </select>
                </div>

                <div className={styles.controlRow}>
                    <label>Dashboard Width</label>
                    <select
                        className={styles.select}
                        value={config.layout?.containerWidth || 'centered'}
                        onChange={(e) => updateLayout('containerWidth', e.target.value)}
                    >
                        <option value="full">Full Screen</option>
                        <option value="centered">Centered (Default)</option>
                        <option value="compact">Compact</option>
                    </select>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Applications</h2>

                <div className={styles.controlRow}>
                    <label>Display Full Size Buttons</label>
                    <div
                        className={`${styles.toggle} ${config.layout?.fullSizeButtons ? styles.active : ''}`}
                        onClick={() => updateLayout('fullSizeButtons', !config.layout?.fullSizeButtons)}
                    >
                        <div className={styles.thumb} />
                    </div>
                </div>

                <div className={styles.actionsRow}>
                    <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-app'); }}>
                        <Plus size={16} /> Add Application
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setActiveModal('edit-app')}>
                        <Edit3 size={16} /> Edit Applications
                    </button>
                    <button className={styles.btnDanger} onClick={handleDeleteAllServices}>
                        <Trash2 size={16} /> Delete All Applications
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Bookmarks</h2>
                <div className={styles.actionsRow}>
                    <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-link'); }}>
                        <Plus size={16} /> Add Bookmark
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setActiveModal('edit-link')}>
                        <Edit3 size={16} /> Edit Bookmarks
                    </button>
                    <button className={styles.btnDanger} onClick={handleDeleteAllLinks}>
                        <Trash2 size={16} /> Delete All Bookmarks
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Widgets</h2>
                <div className={styles.actionsRow}>
                    <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-widget'); }}>
                        <Plus size={16} /> Add Widget
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setActiveModal('edit-widget')}>
                        <Edit3 size={16} /> Edit Widgets
                    </button>
                    <button className={styles.btnDanger}
                        onClick={() => {
                            if (!config) return;
                            toast('Delete ALL widgets?', {
                                action: {
                                    label: 'Delete',
                                    onClick: () => updateConfig({ ...config, widgets: [] })
                                },
                                cancel: { label: 'Cancel', onClick: () => { } }
                            });
                        }}
                    >
                        <Trash2 size={16} /> Delete All Widgets
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Users</h2>
                <UserManagement />
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Data & Backup</h2>
                <div className={styles.actionsRow}>
                    <button onClick={() => {
                        window.location.href = '/api/backup/db';
                        toast.success('Downloading database...');
                    }} className={styles.btnSecondary}>
                        <Download size={16} /> Download DB
                    </button>
                    <button onClick={() => {
                        setConfigJson(JSON.stringify(config, null, 2));
                        setActiveModal('config');
                    }} className={styles.btnPrimary}>
                        <Code size={16} /> Edit Config
                    </button>
                    <button onClick={handleExport} className={styles.btnSecondary}>
                        <Download size={16} /> Export JSON
                    </button>
                    <label className={styles.btnSecondary}>
                        <Upload size={16} /> Import JSON
                        <input type="file" hidden onChange={handleImport} accept=".json" />
                    </label>
                </div>
            </section>

            {/* Modals */}
            {activeModal === 'add-app' && (
                <AddServiceModal
                    category="Applications"
                    onClose={() => { setActiveModal(null); setEditingItem(null); }}
                    onSave={handleAddService}
                    initialData={editingItem}
                />
            )}
            {activeModal === 'add-link' && (
                <AddServiceModal
                    category="Bookmarks"
                    onClose={() => { setActiveModal(null); setEditingItem(null); }}
                    onSave={handleAddLink}
                    initialData={editingItem}
                />
            )}
            {activeModal === 'add-widget' && (
                <AddWidgetModal
                    onClose={() => { setActiveModal(null); setEditingWidget(null); }}
                    initialData={editingWidget}
                    onSave={(newWidget) => {
                        if (!config) return;
                        const currentWidgets = config.widgets || [];
                        const exists = currentWidgets.some(w => w.id === newWidget.id);

                        let updatedWidgets;
                        if (exists) {
                            updatedWidgets = currentWidgets.map(w => w.id === newWidget.id ? newWidget : w);
                        } else {
                            updatedWidgets = [...currentWidgets, newWidget];
                        }

                        updateConfig({ ...config, widgets: updatedWidgets });
                        toast.success(exists ? 'Widget updated' : 'Widget added');
                    }}
                />
            )}
            {activeModal === 'edit-app' && (
                <EditServiceModal
                    title="Applications"
                    services={config.services}
                    onClose={() => setActiveModal(null)}
                    onDelete={handleDeleteServices}
                    onEdit={(service) => {
                        setEditingItem(service);
                        // Close edit modal, open add (edit) modal
                        setActiveModal('add-app');
                    }}
                />
            )}
            {activeModal === 'edit-link' && (
                <EditServiceModal
                    title="Bookmarks"
                    services={config.links.map(linkToService)}
                    onClose={() => setActiveModal(null)}
                    onDelete={handleDeleteLinks}
                    onEdit={(service) => {
                        setEditingItem(service);
                        setActiveModal('add-link');
                    }}
                />
            )}
            {activeModal === 'edit-widget' && (
                <EditWidgetModal
                    widgets={config.widgets || []}
                    onClose={() => setActiveModal(null)}
                    onDelete={(ids) => {
                        if (!config) return;
                        updateConfig({
                            ...config,
                            widgets: config.widgets?.filter(w => !ids.includes(w.id))
                        });
                        setActiveModal(null);
                    }}
                    onEdit={(widget) => {
                        setEditingWidget(widget);
                        setActiveModal('add-widget');
                    }}
                />
            )}

            {/* Config Editor Modal */}
            {activeModal === 'config' && (
                <div className={styles.modalOverlay}>
                    <div className={styles.configModal}>
                        <div className={styles.configModalHeader}>
                            <h3>Edit Config (JSON)</h3>
                            <button onClick={() => setActiveModal(null)} className={styles.closeBtn}>
                                <X size={20} />
                            </button>
                        </div>
                        <textarea
                            className={styles.configTextarea}
                            value={configJson}
                            onChange={(e) => setConfigJson(e.target.value)}
                            spellCheck={false}
                        />
                        <div className={styles.configModalFooter}>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => {
                                    try {
                                        const parsed = JSON.parse(configJson);
                                        updateConfig(parsed);
                                        setActiveModal(null);
                                        alert('Config saved!');
                                    } catch {
                                        alert('Invalid JSON! Please fix errors.');
                                    }
                                }}
                            >
                                <Save size={16} /> Save Config
                            </button>
                            <button className={styles.btnSecondary} onClick={() => setActiveModal(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
