'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, Download, Plus, Sun, Moon, Code, X, Lock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Service, Link as AppLink, Widget } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import AddServiceModal from '@/components/modals/AddServiceModal';
import AddWidgetModal from '@/components/modals/AddWidgetModal';
import UserManagement from '@/components/ui/UserManagement';
import ClientManager from '@/components/oauth/ClientManager';
import AuthProviderManager from '@/components/oauth/AuthProviderManager';
import EditableTable from '@/components/settings/EditableTable';
import WidgetTable from '@/components/settings/WidgetTable';
import { useConfig } from '@/context/ConfigContext';
import styles from './page.module.css';

export default function SettingsPage() {
    const { theme, toggleTheme } = useTheme();
    const { config, updateConfig, loading: contextLoading } = useConfig();
    const [activeModal, setActiveModal] = useState<'add-app' | 'edit-app' | 'add-link' | 'edit-link' | 'config' | 'add-widget' | 'edit-widget' | null>(null);
    const [configJson, setConfigJson] = useState('');
    const [editingItem, setEditingItem] = useState<Service | null>(null);
    const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
    const [localTitle, setLocalTitle] = useState('');
    const [localLocation, setLocalLocation] = useState('');
    const [activeSection, setActiveSection] = useState('general');

    // Role protection
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);

    useEffect(() => {
        if (config) {
            setLocalTitle(config.title || '');
            setLocalLocation(config.weather?.location || '');
        }
    }, [config]);

    useEffect(() => {
        // Check current user role
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUserRole(data.user.role || 'member');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading || contextLoading) return <div className={styles.loading}>Loading...</div>;

    if (userRole !== 'admin') {
        return (
            <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--card-bg)' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                        <div style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            <Lock size={48} />
                        </div>
                    </div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Access Denied</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        You do not have administrative permissions to access the settings configuration.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button className={styles.btnPrimary} onClick={() => window.location.href = '/'}>
                            Return to Dashboard
                        </button>
                        <button
                            className={styles.btnSecondary}
                            onClick={async () => {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                window.location.href = '/login';
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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

    // handleDeleteAllServices removed (unused)

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
    // handleDeleteAllLinks removed (unused)

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



    const renderContent = () => {
        switch (activeSection) {
            // ... (case general stays same)
            case 'general':
                return (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>General</h2>
                        <p className={styles.sectionDesc}>Show or hide widgets on your dashboard.</p>

                        <div className={styles.controlRow}>
                            <label>Show Widgets</label>
                            <div
                                className={`${styles.toggle} ${config?.layout?.showWidgets ? styles.active : ''}`}
                                onClick={() => updateLayout('showWidgets', !config?.layout?.showWidgets)}
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
                                value={config?.searchEngine || 'Google'}
                                onChange={(e) => config && updateConfig({ ...config, searchEngine: e.target.value })}
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
                                value={config?.layout?.containerWidth || 'centered'}
                                onChange={(e) => updateLayout('containerWidth', e.target.value)}
                            >
                                <option value="full">Full Screen</option>
                                <option value="centered">Centered (Default)</option>
                                <option value="compact">Compact</option>
                            </select>
                        </div>
                    </section>
                );
            case 'applications':
                return (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h2 className={styles.sectionTitle}>Applications</h2>
                                <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Manage your dashboard applications.</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-app'); }}>
                                <Plus size={16} /> Add Application
                            </button>
                        </div>

                        <div className={styles.controlRow}>
                            <label>Display Full Size Buttons</label>
                            <div
                                className={`${styles.toggle} ${config?.layout?.fullSizeButtons ? styles.active : ''}`}
                                onClick={() => updateLayout('fullSizeButtons', !config?.layout?.fullSizeButtons)}
                            >
                                <div className={styles.thumb} />
                            </div>
                        </div>

                        <EditableTable
                            title="Applications"
                            items={config?.services || []}
                            onDelete={handleDeleteServices}
                            onEdit={(service) => {
                                setEditingItem(service);
                                setActiveModal('add-app');
                            }}
                        />
                    </section>
                );
            case 'bookmarks':
                return (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h2 className={styles.sectionTitle}>Bookmarks</h2>
                                <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Manage your quick access bookmarks.</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-link'); }}>
                                <Plus size={16} /> Add Bookmark
                            </button>
                        </div>

                        <EditableTable
                            title="Bookmarks"
                            items={(config?.links || []).map(linkToService)}
                            onDelete={handleDeleteLinks}
                            onEdit={(service) => {
                                setEditingItem(service);
                                setActiveModal('add-link');
                            }}
                        />
                    </section>
                );
            case 'widgets':
                return (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h2 className={styles.sectionTitle}>Widgets</h2>
                                <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Manage information widgets.</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => { setEditingItem(null); setActiveModal('add-widget'); }}>
                                <Plus size={16} /> Add Widget
                            </button>
                        </div>

                        <WidgetTable
                            widgets={config?.widgets || []}
                            onDelete={(ids) => {
                                if (!config) return;
                                updateConfig({
                                    ...config,
                                    widgets: config.widgets?.filter(w => !ids.includes(w.id))
                                });
                            }}
                            onEdit={(widget) => {
                                setEditingWidget(widget);
                                setActiveModal('add-widget');
                            }}
                        />
                    </section>
                );
            case 'users':
                return (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Users</h2>
                        <UserManagement />
                    </section>
                );
            case 'sso':
                return (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>SSO Provider</h2>
                        <p className={styles.sectionDesc}>
                            Configure OAuth2/OIDC applications that can authenticate through Atom.
                            Applications you add here can use Atom as their identity provider for single sign-on.
                        </p>

                        <div className={styles.infoBox}>
                            <h4>OAuth2/OIDC Endpoints</h4>
                            <p>Use these endpoints when configuring OAuth2 or OIDC in your applications:</p>
                            <ul>
                                <li><code>Discovery (OIDC):</code> <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/.well-known/openid-configuration</code></li>
                                <li><code>Authorization:</code> <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/oauth/authorize</code></li>
                                <li><code>Token:</code> <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/oauth/token</code></li>
                                <li><code>UserInfo:</code> <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/oauth/userinfo</code></li>
                                <li><code>JWKS:</code> <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/.well-known/jwks.json</code></li>
                            </ul>
                            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <strong>Supported scopes:</strong> <code>openid</code>, <code>profile</code>, <code>username</code>, <code>email</code>
                            </p>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                For OIDC-compliant apps (oauth2-proxy, Grafana, etc.), use the Discovery URL for auto-configuration.
                            </p>
                        </div>

                        <ClientManager />
                    </section>
                );
            case 'external':
                return (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>External Login Providers</h2>
                        <p className={styles.sectionDesc}>
                            Allow users to sign in to Atom using external services like Google, Authentik, or GitHub.
                        </p>

                        <div className={styles.infoBox}>
                            <h4>Callback URL / Redirect URI</h4>
                            <p>When configuring your identity provider, set the <strong>Callback URL</strong> to:</p>
                            <code style={{ display: 'block', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', margin: '0.5rem 0', wordBreak: 'break-all' }}>
                                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/auth/<strong>[slug]</strong>/callback
                            </code>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Replace <code>[slug]</code> with the identifier you enter below (e.g., <code>authentik</code>).
                            </p>
                        </div>
                        <div style={{ padding: '0 0.5rem' }}>
                            <AuthProviderManager />
                        </div>
                    </section>
                );
            case 'backup':
                return (
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
                                if (config) setConfigJson(JSON.stringify(config, null, 2));
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
                );
            default:
                return null;
        }
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
                    <Link href="/" className={styles.backBtn}> <ArrowLeft size={16} /> Back to Dashboard</Link>
                </div>
            </header>

            <div className={styles.mainContainer}>
                <aside className={styles.sidebar}>
                    <div className={styles.navSectionTitle}>General</div>
                    <div className={`${styles.navItem} ${activeSection === 'general' ? styles.active : ''}`} onClick={() => setActiveSection('general')}>
                        General
                    </div>
                    <div className={styles.navSectionTitle}>Content</div>
                    <div className={`${styles.navItem} ${activeSection === 'applications' ? styles.active : ''}`} onClick={() => setActiveSection('applications')}>
                        Applications
                    </div>
                    <div className={`${styles.navItem} ${activeSection === 'bookmarks' ? styles.active : ''}`} onClick={() => setActiveSection('bookmarks')}>
                        Bookmarks
                    </div>
                    <div className={`${styles.navItem} ${activeSection === 'widgets' ? styles.active : ''}`} onClick={() => setActiveSection('widgets')}>
                        Widgets
                    </div>
                    <div className={styles.navSectionTitle}>Access & Security</div>
                    <div className={`${styles.navItem} ${activeSection === 'users' ? styles.active : ''}`} onClick={() => setActiveSection('users')}>
                        Users
                    </div>
                    <div className={`${styles.navItem} ${activeSection === 'sso' ? styles.active : ''}`} onClick={() => setActiveSection('sso')}>
                        SSO Provider
                    </div>
                    <div className={`${styles.navItem} ${activeSection === 'external' ? styles.active : ''}`} onClick={() => setActiveSection('external')}>
                        External Login
                    </div>
                    <div className={styles.navSectionTitle}>System</div>
                    <div className={`${styles.navItem} ${activeSection === 'backup' ? styles.active : ''}`} onClick={() => setActiveSection('backup')}>
                        Data & Backup
                    </div>
                </aside>

                <main className={styles.content}>
                    {renderContent()}
                </main>
            </div>

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
