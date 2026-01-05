'use client';

import { useState, useEffect } from 'react';
import { Plus, Copy, Trash2, ExternalLink } from 'lucide-react';
import styles from './ProxyManager.module.css';

interface ProtectedApp {
    id: number;
    name: string;
    slug: string;
    backend_url: string;
    require_auth: boolean;
    allowed_users: string[] | null;
    inject_headers: boolean;
    strip_auth_header: boolean;
    created_at: string;
}

export default function ProxyManager() {
    const [apps, setApps] = useState<ProtectedApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newApp, setNewApp] = useState({
        name: '',
        slug: '',
        backend_url: '',
        require_auth: true,
        allowed_users: '',
        inject_headers: true,
        strip_auth_header: true,
    });
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    useEffect(() => {
        fetchApps();
    }, []);

    const fetchApps = async () => {
        try {
            const res = await fetch('/api/proxy/apps');
            const data = await res.json();
            setApps(data.applications || []);
        } catch (error) {
            console.error('Failed to fetch protected apps:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddApp = async () => {
        try {
            const payload = {
                ...newApp,
                allowed_users: newApp.allowed_users
                    ? newApp.allowed_users.split(',').map(u => u.trim()).filter(u => u.length > 0)
                    : null,
            };

            const res = await fetch('/api/proxy/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setNewApp({
                    name: '',
                    slug: '',
                    backend_url: '',
                    require_auth: true,
                    allowed_users: '',
                    inject_headers: true,
                    strip_auth_header: true,
                });
                setShowAddForm(false);
                fetchApps();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create protected app');
            }
        } catch (error) {
            console.error('Failed to create protected app:', error);
            alert('Failed to create protected app');
        }
    };

    const handleDeleteApp = async (slug: string) => {
        if (!confirm(`Are you sure you want to delete this protected application?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/proxy/apps?slug=${slug}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchApps();
            } else {
                alert('Failed to delete protected app');
            }
        } catch (error) {
            console.error('Failed to delete protected app:', error);
            alert('Failed to delete protected app');
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedUrl(id);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const getProxyUrl = (slug: string) => {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/api/proxy/${slug}/`;
    };

    if (loading) {
        return <div className={styles.container}>Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Protected Applications</h2>
                <button onClick={() => setShowAddForm(true)} className={styles.addButton}>
                    <Plus size={18} /> Add Application
                </button>
            </div>

            {/* Add App Form */}
            {showAddForm && (
                <div className={styles.formCard}>
                    <h3>New Protected Application</h3>

                    <div className={styles.formGroup}>
                        <label>Application Name *</label>
                        <input
                            type="text"
                            value={newApp.name}
                            onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                            placeholder="Grafana"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>URL Slug * <span className={styles.hint}>(lowercase, hyphens only)</span></label>
                        <input
                            type="text"
                            value={newApp.slug}
                            onChange={(e) => setNewApp({ ...newApp, slug: e.target.value.toLowerCase() })}
                            placeholder="grafana"
                            pattern="[a-z0-9-]+"
                        />
                        {newApp.slug && (
                            <div className={styles.preview}>
                                Proxy URL: <code>{getProxyUrl(newApp.slug)}*</code>
                            </div>
                        )}
                    </div>

                    <div className={styles.formGroup}>
                        <label>Backend URL *</label>
                        <input
                            type="url"
                            value={newApp.backend_url}
                            onChange={(e) => setNewApp({ ...newApp, backend_url: e.target.value })}
                            placeholder="http://grafana:3000"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>
                            <input
                                type="checkbox"
                                checked={newApp.require_auth}
                                onChange={(e) => setNewApp({ ...newApp, require_auth: e.target.checked })}
                            />
                            <span>Require Authentication</span>
                        </label>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Allowed Users <span className={styles.hint}>(comma-separated, empty = all users)</span></label>
                        <input
                            type="text"
                            value={newApp.allowed_users}
                            onChange={(e) => setNewApp({ ...newApp, allowed_users: e.target.value })}
                            placeholder="admin, user1, user2"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>
                            <input
                                type="checkbox"
                                checked={newApp.inject_headers}
                                onChange={(e) => setNewApp({ ...newApp, inject_headers: e.target.checked })}
                            />
                            <span>Inject Auth Headers (X-Auth-User, X-Remote-User)</span>
                        </label>
                    </div>

                    <div className={styles.formActions}>
                        <button onClick={() => setShowAddForm(false)} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button onClick={handleAddApp} className={styles.saveButton}>
                            Create Application
                        </button>
                    </div>
                </div>
            )}

            {/* App List */}
            {apps.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No protected applications configured</p>
                    <p className={styles.emptyHint}>Add an application to enable authentication proxy</p>
                </div>
            ) : (
                <div className={styles.appList}>
                    {apps.map((app) => (
                        <div key={app.id} className={styles.appCard}>
                            <div className={styles.appHeader}>
                                <div>
                                    <h4>{app.name}</h4>
                                    <code className={styles.slug}>{app.slug}</code>
                                </div>
                                <button
                                    onClick={() => handleDeleteApp(app.slug)}
                                    className={styles.deleteButton}
                                    title="Delete application"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className={styles.appDetails}>
                                <div className={styles.detailRow}>
                                    <span>Backend URL:</span>
                                    <code>{app.backend_url}</code>
                                    <a href={app.backend_url} target="_blank" rel="noopener noreferrer" title="Open backend">
                                        <ExternalLink size={14} />
                                    </a>
                                </div>

                                <div className={styles.detailRow}>
                                    <span>Proxy URL:</span>
                                    <code>{getProxyUrl(app.slug)}*</code>
                                    <button onClick={() => copyToClipboard(getProxyUrl(app.slug), `${app.id}_url`)}>
                                        {copiedUrl === `${app.id}_url` ? 'Copied!' : <Copy size={14} />}
                                    </button>
                                </div>

                                <div className={styles.detailRow}>
                                    <span>Auth Required:</span>
                                    <span className={app.require_auth ? styles.yes : styles.no}>
                                        {app.require_auth ? 'Yes' : 'No'}
                                    </span>
                                </div>

                                {app.allowed_users && app.allowed_users.length > 0 && (
                                    <div className={styles.detailRow}>
                                        <span>Allowed Users:</span>
                                        <div className={styles.users}>
                                            {app.allowed_users.map(user => (
                                                <span key={user} className={styles.user}>{user}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className={styles.detailRow}>
                                    <span>Headers:</span>
                                    <span className={styles.meta}>
                                        {app.inject_headers ? '✓ Inject auth headers' : '✗ No headers'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
