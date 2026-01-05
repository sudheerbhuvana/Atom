'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getOAuthClientByClientId } from '@/lib/db-oauth';
import styles from './page.module.css';

function ConsentContent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [clientInfo, setClientInfo] = useState<{
        name: string;
        description?: string;
    } | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();

    const client_id = searchParams.get('client_id') || '';
    const redirect_uri = searchParams.get('redirect_uri') || '';
    const scope = searchParams.get('scope') || 'openid';
    const state = searchParams.get('state') || '';
    const code_challenge = searchParams.get('code_challenge') || '';
    const code_challenge_method = searchParams.get('code_challenge_method') || '';

    const scopes = scope.split(' ').filter(s => s.length > 0);

    // Fetch client information
    useEffect(() => {
        if (!client_id) {
            setError('Invalid request: missing client_id');
            return;
        }

        // Fetch client details for display
        fetch(`/api/oauth/clients?client_id=${encodeURIComponent(client_id)}`)
            .then(res => res.json())
            .then(data => {
                if (data.client) {
                    setClientInfo({
                        name: data.client.name,
                        description: data.client.description,
                    });
                } else {
                    setError('Application not found');
                }
            })
            .catch(() => {
                setError('Failed to load application information');
            });
    }, [client_id]);

    const handleApprove = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/oauth/authorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    client_id,
                    redirect_uri,
                    scope,
                    state,
                    code_challenge,
                    code_challenge_method,
                    approved: true,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error_description || 'Authorization failed');
                setLoading(false);
                return;
            }

            // Redirect back to application
            window.location.href = data.redirect_uri;
        } catch {
            setError('Something went wrong');
            setLoading(false);
        }
    };

    const handleDeny = async () => {
        setLoading(true);

        try {
            const res = await fetch('/api/oauth/authorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    client_id,
                    redirect_uri,
                    scope,
                    state,
                    approved: false,
                }),
            });

            const data = await res.json();

            // Redirect back to application with error
            window.location.href = data.redirect_uri;
        } catch {
            setError('Something went wrong');
            setLoading(false);
        }
    };

    const getScopeDescription = (scope: string): string => {
        const descriptions: Record<string, string> = {
            openid: 'Access your basic profile information',
            profile: 'Access your username and profile',
            username: 'Access your username',
            email: 'Access your email address',
        };
        return descriptions[scope] || scope;
    };

    if (error && !clientInfo) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Authorization Error</h1>
                    <div className={styles.error}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Authorize Application</h1>

                {clientInfo && (
                    <>
                        <div className={styles.clientInfo}>
                            <p className={styles.clientName}>{clientInfo.name}</p>
                            {clientInfo.description && (
                                <p className={styles.clientDescription}>{clientInfo.description}</p>
                            )}
                            <p className={styles.subtitle}>wants to access your Atom account</p>
                        </div>

                        <div className={styles.permissions}>
                            <h3>This application will be able to:</h3>
                            <ul>
                                {scopes.map(scope => (
                                    <li key={scope}>{getScopeDescription(scope)}</li>
                                ))}
                            </ul>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <div className={styles.buttonGroup}>
                            <button
                                onClick={handleDeny}
                                className={`${styles.button} ${styles.buttonSecondary}`}
                                disabled={loading}
                            >
                                Deny
                            </button>
                            <button
                                onClick={handleApprove}
                                className={styles.button}
                                disabled={loading}
                            >
                                {loading ? 'Authorizing...' : 'Allow'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function ConsentPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <p className={styles.subtitle}>Loading...</p>
                </div>
            </div>
        }>
            <ConsentContent />
        </Suspense>
    );
}
