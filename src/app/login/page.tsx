'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const router = useRouter();

    // Check if onboarding is needed
    useEffect(() => {
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
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed');
                return;
            }

            router.push('/');
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
            </div>
        </div>
    );
}
