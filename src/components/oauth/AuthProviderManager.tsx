'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Key, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import styles from './ClientManager.module.css'; // Reuse existing styles if compatible or duplicate

interface AuthProvider {
    name: string;
    slug: string;
    issuer: string;
    client_id: string;
    enabled: boolean;
}

export default function AuthProviderManager() {
    const [providers, setProviders] = useState<AuthProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [issuer, setIssuer] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');

    const fetchProviders = async () => {
        try {
            const res = await fetch('/api/auth/providers?all=true');
            if (res.ok) {
                const data = await res.json();
                setProviders(data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load identity providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/auth/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'), // Basic slugify
                    issuer,
                    client_id: clientId,
                    client_secret: clientSecret,
                    enabled: true
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to create provider');

            toast.success('Identity Provider added successfully');
            setShowForm(false);

            // Reset form
            setName('');
            setSlug('');
            setIssuer('');
            setClientId('');
            setClientSecret('');

            fetchProviders();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'An error occurred';
            toast.error(errorMsg);
        }
    };

    const handleDelete = async (slugToDelete: string) => {
        if (!confirm('Are you sure you want to delete this provider? Users linked to this provider will usually remain, but cannot login via this method anymore.')) return;

        try {
            const res = await fetch('/api/auth/providers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: slugToDelete })
            });

            if (!res.ok) throw new Error('Failed to delete provider');

            toast.success('Provider deleted');
            fetchProviders();
        } catch (error) {
            toast.error('Failed to delete provider');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h3 className={styles.title}>Identity Providers</h3>
                    <p className={styles.subtitle}>Configure external services (Google, Authentik, etc.) for Single Sign-On.</p>
                </div>
                {!showForm && (
                    <button className={styles.addButton} onClick={() => setShowForm(true)}>
                        <Plus size={16} /> Add Provider
                    </button>
                )}
            </div>

            {showForm && (
                <div className={styles.formCard}>
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label>Display Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Authentik"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                                }}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Slug (URL identifier)</label>
                            <input
                                type="text"
                                placeholder="e.g. authentik"
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                                required
                            />
                            <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Used in URL: /api/auth/<b>{slug || '...'}</b>/login
                            </small>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Issuer URL</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Globe size={16} className={styles.inputIcon} />
                                <input
                                    type="url"
                                    placeholder="https://authentik.company.com/application/o/atom/"
                                    value={issuer}
                                    onChange={e => setIssuer(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>Client ID</label>
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Client Secret</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.formActions}>
                            <button type="button" className={styles.cancelButton} onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className={styles.saveButton}>Save Provider</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={styles.clientList}>
                {loading ? (
                    <div className={styles.loading}>Loading providers...</div>
                ) : providers.length === 0 ? (
                    <div className={styles.emptyState}>No identity providers configured.</div>
                ) : (
                    providers.map(p => (
                        <div key={p.slug} className={styles.clientItem}>
                            <div className={styles.clientInfo}>
                                <div className={styles.clientName}>
                                    {p.name}
                                    <span className={styles.clientId}>{p.slug}</span>
                                </div>
                                <div className={styles.clientScopes} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Globe size={12} /> {p.issuer}
                                </div>
                            </div>
                            <button
                                className={styles.deleteButton}
                                onClick={() => handleDelete(p.slug)}
                                title="Delete Provider"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
