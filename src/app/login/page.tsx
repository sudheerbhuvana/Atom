'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSafeRedirectUrl } from '@/lib/redirect-utils';
import styles from './page.module.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [providers, setProviders] = useState<{ name: string; slug: string }[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get('returnTo');

    // Check if onboarding is needed & Check for errors & fetch providers
    useEffect(() => {
        // Parse URL params for errors
        const errorMsg = searchParams.get('error');
        if (errorMsg) {
            setError(decodeURIComponent(errorMsg));
        }

        // Fetch Providers
        fetch('/api/auth/providers')
            .then(res => res.json())
            .then((data: any) => {
                if (Array.isArray(data)) {
                    setProviders(data);

                    // Auto-launch if exactly one provider with auto_launch enabled
                    const autoLaunchProviders = data.filter((p: any) => p.auto_launch);
                    // Preserve returnTo when auto-launching
                    const returnToParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

                    if (autoLaunchProviders.length === 1) {
                        const provider = autoLaunchProviders[0];
                        window.location.href = `/api/auth/${provider.slug}/login${returnToParam}`;
                        return; // Exit early since we're redirecting
                    }
                }
            })
            .catch(console.error);

        // Safety timeout in case fetch hangs
        const timeout = setTimeout(() => setChecking(false), 5000);

        fetch('/api/auth/session', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                clearTimeout(timeout);
                if (data.needsOnboarding) {
                    router.push('/onboard');
                } else if (data.user) {
                    router.push('/');
                } else {
                    setChecking(false);
                }
            })
            .catch(() => {
                clearTimeout(timeout);
                setChecking(false);
            });

        return () => clearTimeout(timeout);
    }, [router, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    returnTo: returnTo || undefined
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed');
                return;
            }

            // Use validated redirect URL from server or fallback to root
            const redirectUrl = getSafeRedirectUrl(
                data.redirect || returnTo,
                '/',
                window.location.origin
            );

            router.push(redirectUrl);
        } catch {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <p className={styles.subtitle}>Initializing...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Welcome Back</h1>
                <p className={styles.subtitle}>Sign in to your Atom dashboard</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            required
                            autoFocus
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {providers.length > 0 && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Or continue with
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {providers.map(p => {
                                // Preserve returnTo when using OAuth providers
                                const providerUrl = returnTo
                                    ? `/api/auth/${p.slug}/login?returnTo=${encodeURIComponent(returnTo)}`
                                    : `/api/auth/${p.slug}/login`;

                                return (
                                    <button
                                        key={p.slug}
                                        type="button"
                                        className={styles.button}
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)'
                                        }}
                                        onClick={() => window.location.href = providerUrl}
                                    >
                                        Sign in with {p.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
