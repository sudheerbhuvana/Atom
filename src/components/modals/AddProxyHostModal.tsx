'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Globe, Box, Link } from 'lucide-react';
import { toast } from 'sonner';
import { DockerContainer } from '@/types';
import styles from './AddProxyHostModal.module.css';

interface ProxyHost {
    id?: string;
    domain: string;
    targetPort: number;
    ssl?: boolean;
    letsencrypt?: boolean;
}

interface Props {
    onClose: () => void;
}

export default function AddProxyHostModal({ onClose }: Props) {
    const [hosts, setHosts] = useState<ProxyHost[]>([]);
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [selectedContainerId, setSelectedContainerId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [domain, setDomain] = useState('');
    const [targetPort, setTargetPort] = useState('');
    const [ssl, setSsl] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchHosts();
        fetchContainers();
    }, []);

    const fetchHosts = async () => {
        try {
            const res = await fetch('/api/docker/proxy');
            if (res.ok) {
                const data = await res.json();
                setHosts(data.hosts || []);
            }
        } catch (error) {
            console.error('Failed to fetch proxy hosts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContainers = async () => {
        try {
            const res = await fetch('/api/docker/containers');
            if (res.ok) {
                const data = await res.json();
                setContainers(data.containers || []);
            }
        } catch (error) {
            console.error('Failed to fetch containers:', error);
        }
    };

    const handleContainerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedContainerId(id);

        if (id) {
            const container = containers.find(c => c.id === id);
            if (container) {
                // Peek first public port if available, otherwise fallback
                const firstPortMatch = container.ports?.match(/:(\d+)/);
                if (firstPortMatch) {
                    setTargetPort(firstPortMatch[1]);
                } else if (container.ports) {
                    const port = container.ports.split(',')[0].split(':')[1];
                    if (port) setTargetPort(port);
                }
            }
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/docker/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain,
                    targetPort: parseInt(targetPort, 10),
                    ssl,
                    letsencrypt: ssl // SSL implies Let's Encrypt in this simplified UI
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to add proxy host');
            }

            toast.success(`Proxy host added: ${domain}`);
            setDomain('');
            setTargetPort('');
            setSsl(false);
            setSelectedContainerId('');
            fetchHosts();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'An error occurred';
            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, domain: string) => {
        if (!confirm(`Delete proxy host for ${domain}?`)) return;

        try {
            const res = await fetch('/api/docker/proxy', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }

            toast.success(`Deleted: ${domain}`);
            fetchHosts();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'An error occurred';
            toast.error(errorMsg);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Reverse Proxy Manager</h2>
                        <p className={styles.subtitle}>Manage Domain to Container routing</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <form onSubmit={handleAdd} className={styles.form}>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Container (Optional)</label>
                                <div className={styles.selectWrapper}>
                                    <Box size={14} className={styles.selectIcon} />
                                    <select
                                        value={selectedContainerId}
                                        onChange={handleContainerChange}
                                        className={styles.select}
                                    >
                                        <option value="">Manual Setup</option>
                                        {containers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Domain</label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="app.example.com"
                                    required
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Target Port</label>
                                <input
                                    type="number"
                                    value={targetPort}
                                    onChange={(e) => setTargetPort(e.target.value)}
                                    placeholder="3000"
                                    required
                                />
                            </div>

                            <div className={styles.checkboxGroup}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={ssl}
                                        onChange={(e) => setSsl(e.target.checked)}
                                    />
                                    <span>SSL (Let's Encrypt)</span>
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button type="submit" className={styles.addBtn} disabled={submitting}>
                                    <Plus size={16} />
                                    {submitting ? 'Adding...' : 'Add Proxy'}
                                </button>
                            </div>
                        </div>

                        {selectedContainerId && (
                            <div className={styles.hint}>
                                <Link size={12} />
                                Target will be set to <code>host.docker.internal:{targetPort}</code>
                            </div>
                        )}
                    </form>

                    <div className={styles.listSection}>
                        <h3 className={styles.listTitle}>Configured Hosts ({hosts.length})</h3>
                        {loading ? (
                            <div className={styles.loading}>Loading...</div>
                        ) : hosts.length === 0 ? (
                            <div className={styles.empty}>No proxy hosts configured</div>
                        ) : (
                            <div className={styles.hostList}>
                                {hosts.map((host) => (
                                    <div key={host.id || host.domain} className={styles.hostItem}>
                                        <div className={styles.hostInfo}>
                                            <div className={styles.hostDomain}>
                                                <Globe size={16} />
                                                <span>{host.domain}</span>
                                                {host.ssl && <span className={styles.sslBadge}>HTTPS</span>}
                                            </div>
                                            <div className={styles.hostTarget}>
                                                <Link size={12} />
                                                Forward to: <code>host.docker.internal:{host.targetPort}</code>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDelete(host.id || 'missing-id', host.domain)}
                                            title="Delete proxy host"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
