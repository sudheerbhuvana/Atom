'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import styles from './ClientManager.module.css'; // Reuse existing styles if compatible or duplicate

interface AuthProvider {
    name: string;
    slug: string;
    issuer: string;
    client_id: string;
    enabled: boolean;
}

interface AuthProviderDetails extends AuthProvider {
    authorization_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
    scopes?: string;
    user_match_field?: 'email' | 'username' | 'sub';
    auto_register?: boolean;
    auto_launch?: boolean;
}

export default function AuthProviderManager() {
    const [providers, setProviders] = useState<AuthProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [issuer, setIssuer] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [authEndpoint, setAuthEndpoint] = useState('');
    const [tokenEndpoint, setTokenEndpoint] = useState('');
    const [userInfoEndpoint, setUserInfoEndpoint] = useState('');
    const [scopes, setScopes] = useState('');
    const [userMatchField, setUserMatchField] = useState<'email' | 'username' | 'sub'>('email');
    const [autoRegister, setAutoRegister] = useState(true);
    const [autoLaunch, setAutoLaunch] = useState(false);

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

    const resetForm = () => {
        setName('');
        setSlug('');
        setIssuer('');
        setClientId('');
        setClientSecret('');
        setAuthEndpoint('');
        setTokenEndpoint('');
        setUserInfoEndpoint('');
        setScopes('');
        setUserMatchField('email');
        setAutoRegister(true);
        setAutoLaunch(false);
        setEditingProvider(null);
        setShowForm(false);
    };

    const handleEdit = (provider: AuthProvider) => {
        setName(provider.name);
        setSlug(provider.slug);
        setIssuer(provider.issuer);
        setClientId(provider.client_id);
        // Secrets are not returned by API for security, so leave blank or handle "unchanged" logic
        // For now user has to re-enter secret if they edit, or we make it optional in backend validation?
        // Backend updateAuthProvider handles partial updates. If secret is empty string, we shouldn't send it?
        // Let's assume we need to re-enter for now, or send only if changed.
        // Actually, backend expects full object or partial.
        setClientSecret(''); // User must re-enter or we need to handle "keep existing" logic

        // Endpoints might not be in the list API response if we didn't add them to the select?
        // The list API does 'SELECT *', so they should be there.
        const details = provider as AuthProviderDetails;
        setAuthEndpoint(details.authorization_endpoint || '');
        setTokenEndpoint(details.token_endpoint || '');
        setUserInfoEndpoint(details.userinfo_endpoint || '');
        setScopes(details.scopes || '');
        setUserMatchField(details.user_match_field || 'email');
        setAutoRegister(details.auto_register !== false);
        setAutoLaunch(details.auto_launch || false);

        setEditingProvider(provider.slug);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const method = editingProvider ? 'PUT' : 'POST';
            const body: {
                name: string;
                slug: string;
                issuer: string;
                client_id: string;
                authorization_endpoint?: string;
                token_endpoint?: string;
                userinfo_endpoint?: string;
                scopes?: string;
                enabled: boolean;
                client_secret?: string;
                user_match_field?: 'email' | 'username' | 'sub';
                auto_register?: boolean;
                auto_launch?: boolean;
            } = {
                name,
                slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                issuer,
                client_id: clientId,
                authorization_endpoint: authEndpoint || undefined,
                token_endpoint: tokenEndpoint || undefined,
                userinfo_endpoint: userInfoEndpoint || undefined,
                scopes: scopes || undefined,
                enabled: true,
                user_match_field: userMatchField,
                auto_register: autoRegister,
                auto_launch: autoLaunch
            };

            // Only send secret if it's a new provider OR if the user entered a new one during edit
            if (!editingProvider || clientSecret) {
                body.client_secret = clientSecret;
            }

            const res = await fetch('/api/auth/providers', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to save provider');

            toast.success(editingProvider ? 'Provider updated' : 'Provider added');
            resetForm();
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
        } catch {
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
                    <button className={styles.addButton} onClick={() => { resetForm(); setShowForm(true); }}>
                        <Plus size={16} /> Add Provider
                    </button>
                )}
            </div>

            {showForm && (
                <div className={styles.formCard}>
                    <h4 style={{ marginBottom: '1rem', marginTop: 0 }}>{editingProvider ? 'Edit Provider' : 'Add Provider'}</h4>
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label>Display Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Authentik"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (!editingProvider && !slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
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
                                disabled={!!editingProvider} // Disable slug editing for now to simplify update logic
                                style={editingProvider ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
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
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!issuer) {
                                            toast.error('Please enter an Issuer URL first');
                                            return;
                                        }
                                        const toastId = toast.loading('Discovering endpoints...');
                                        try {
                                            const res = await fetch(`/api/auth/discovery?url=${encodeURIComponent(issuer)}`);
                                            if (!res.ok) throw new Error('Discovery failed');
                                            const config = await res.json();

                                            setAuthEndpoint(config.authorization_endpoint || '');
                                            setTokenEndpoint(config.token_endpoint || '');
                                            setUserInfoEndpoint(config.userinfo_endpoint || '');
                                            // Determine if we should clear secrets or keep them? 
                                            // Discovery doesn't touch secrets generally.

                                            toast.success('Endpoints auto-filled!', { id: toastId });
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Failed to discover OIDC endpoints', { id: toastId });
                                        }
                                    }}
                                    className={styles.btnSecondary}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.85rem',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Auto-fill
                                </button>
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
                                <label>Client Secret {editingProvider && '(Leave blank to keep unchanged)'}</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    required={!editingProvider}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Scopes (Optional)</label>
                            <input
                                type="text"
                                placeholder="openid profile email"
                                value={scopes}
                                onChange={e => setScopes(e.target.value)}
                            />
                            <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Space-separated list of scopes. Defaults to &apos;openid profile email&apos;.
                            </small>
                        </div>

                        <div className={styles.divider} style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>User Matching & Behavior</h4>

                        <div className={styles.formGroup}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500' }}>User Matching Field</label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '0.5rem',
                                marginBottom: '0.5rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setUserMatchField('email')}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: userMatchField === 'email' ? 'var(--accent-color)' : 'var(--bg-primary)',
                                        color: userMatchField === 'email' ? '#fff' : 'var(--text-primary)',
                                        border: `1px solid ${userMatchField === 'email' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: userMatchField === 'email' ? '600' : '500',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Email
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserMatchField('username')}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: userMatchField === 'username' ? 'var(--accent-color)' : 'var(--bg-primary)',
                                        color: userMatchField === 'username' ? '#fff' : 'var(--text-primary)',
                                        border: `1px solid ${userMatchField === 'username' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: userMatchField === 'username' ? '600' : '500',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Username
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserMatchField('sub')}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: userMatchField === 'sub' ? 'var(--accent-color)' : 'var(--bg-primary)',
                                        color: userMatchField === 'sub' ? '#fff' : 'var(--text-primary)',
                                        border: `1px solid ${userMatchField === 'sub' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: userMatchField === 'sub' ? '600' : '500',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    OpenID
                                </button>
                            </div>
                            <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                {userMatchField === 'email' && 'Match users by email address (recommended for most providers)'}
                                {userMatchField === 'username' && 'Match users by username (for internal SSO systems)'}
                                {userMatchField === 'sub' && 'Match only by subject ID (most secure, requires explicit linking)'}
                            </small>
                        </div>

                        <div className={styles.formGroup}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Auto-register new users</div>
                                    <small style={{ color: 'var(--text-muted)' }}>
                                        Automatically create accounts for new users on first login
                                    </small>
                                </div>
                                <label style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '44px',
                                    height: '24px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={autoRegister}
                                        onChange={e => setAutoRegister(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: autoRegister ? 'var(--accent-color)' : '#444',
                                        borderRadius: '24px',
                                        transition: 'background-color 0.3s',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: autoRegister ? '22px' : '2px',
                                            bottom: '2px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: 'left 0.3s'
                                        }}></span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Auto-launch on login page</div>
                                    <small style={{ color: 'var(--text-muted)' }}>
                                        Automatically redirect to this provider if it&apos;s the only enabled one
                                    </small>
                                </div>
                                <label style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '44px',
                                    height: '24px',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={autoLaunch}
                                        onChange={e => setAutoLaunch(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: autoLaunch ? 'var(--accent-color)' : '#444',
                                        borderRadius: '24px',
                                        transition: 'background-color 0.3s',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: autoLaunch ? '22px' : '2px',
                                            bottom: '2px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: 'left 0.3s'
                                        }}></span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className={styles.divider} style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Manual Configuration (Optional)</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Required for providers that don&apos;t support OIDC Discovery (e.g., GitHub).
                            Leave blank to attempt auto-discovery from Issuer URL.
                        </p>

                        <div className={styles.formGroup}>
                            <label>Authorization Endpoint</label>
                            <input
                                type="url"
                                placeholder="e.g. https://github.com/login/oauth/authorize"
                                value={authEndpoint}
                                onChange={e => setAuthEndpoint(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Token Endpoint</label>
                            <input
                                type="url"
                                placeholder="e.g. https://github.com/login/oauth/access_token"
                                value={tokenEndpoint}
                                onChange={e => setTokenEndpoint(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>User Info Endpoint</label>
                            <input
                                type="url"
                                placeholder="e.g. https://api.github.com/user"
                                value={userInfoEndpoint}
                                onChange={e => setUserInfoEndpoint(e.target.value)}
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button type="button" className={styles.cancelButton} onClick={resetForm}>Cancel</button>
                            <button type="submit" className={styles.saveButton}>{editingProvider ? 'Update' : 'Save'} Provider</button>
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
                        <div key={p.slug} className={styles.clientItem} style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '1rem',
                            marginBottom: '0.75rem',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div className={styles.clientInfo}>
                                <div className={styles.clientName} style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                                    {p.name}
                                    <span className={styles.clientId} style={{
                                        marginLeft: '0.5rem',
                                        fontSize: '0.75rem',
                                        padding: '0.1rem 0.4rem',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '4px',
                                        color: 'var(--text-secondary)'
                                    }}>{p.slug}</span>
                                </div>
                                <div className={styles.clientScopes} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <Globe size={12} /> {p.issuer}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={styles.editButton}
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        border: 'none',
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        color: 'var(--text-primary)'
                                    }}
                                    onClick={() => handleEdit(p)}
                                    title="Edit Provider"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    className={styles.deleteButton}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: 'none',
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        color: '#ef4444'
                                    }}
                                    onClick={() => handleDelete(p.slug)}
                                    title="Delete Provider"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
