'use client';

import { useState, useEffect } from 'react';
import { Plus, Copy, Trash2, CheckCircle2, FileCode, Edit3 } from 'lucide-react';
import styles from './ClientManager.module.css';

interface OAuthClient {
    id: number;
    client_id: string;
    name: string;
    description?: string;
    redirect_uris: string[];
    allowed_scopes: string[];
    grant_types: string[];
    created_at: string;
}

export default function ClientManager() {
    const [clients, setClients] = useState<OAuthClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [newClient, setNewClient] = useState({
        name: '',
        description: '',
        redirect_uris: [''],
        allowed_scopes: ['openid', 'username'],
    });
    const [createdClient, setCreatedClient] = useState<(OAuthClient & { client_secret: string }) | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showDockerCompose, setShowDockerCompose] = useState(false);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/oauth/clients', { cache: 'no-store' });
            const data = await res.json();
            setClients(data.clients || []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClient = async () => {
        try {
            const isEdit = !!editingClientId;
            const url = '/api/oauth/clients';
            const method = isEdit ? 'PATCH' : 'POST';

            const body = {
                ...newClient,
                redirect_uris: newClient.redirect_uris.filter(uri => uri.length > 0),
                ...(isEdit ? { client_id: editingClientId } : {})
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();

                if (!isEdit) {
                    setCreatedClient(data.client);
                }

                setNewClient({ name: '', description: '', redirect_uris: [''], allowed_scopes: ['openid', 'profile'] });
                setShowAddForm(false);
                setEditingClientId(null);
                fetchClients();
            } else {
                const error = await res.json();
                alert(error.message || `Failed to ${isEdit ? 'update' : 'create'} client`);
            }
        } catch (error) {
            console.error(`Failed to ${editingClientId ? 'update' : 'create'} client:`, error);
            alert(`Failed to ${editingClientId ? 'update' : 'create'} client`);
        }
    };

    const handleEditClient = (client: OAuthClient) => {
        setNewClient({
            name: client.name,
            description: client.description || '',
            redirect_uris: client.redirect_uris,
            allowed_scopes: client.allowed_scopes,
        });
        setEditingClientId(client.client_id);
        setShowAddForm(true);
    };

    const handleCancel = () => {
        setShowAddForm(false);
        setEditingClientId(null);
        setNewClient({ name: '', description: '', redirect_uris: [''], allowed_scopes: ['openid', 'profile'] });
    }

    const handleDeleteClient = async (client_id: string) => {
        if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`/api/oauth/clients?client_id=${client_id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchClients();
            } else {
                alert('Failed to delete client');
            }
        } catch (error) {
            console.error('Failed to delete client:', error);
            alert('Failed to delete client');
        }
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const addRedirectUri = () => {
        setNewClient({ ...newClient, redirect_uris: [...newClient.redirect_uris, ''] });
    };

    const updateRedirectUri = (index: number, value: string) => {
        const updated = [...newClient.redirect_uris];
        updated[index] = value;
        setNewClient({ ...newClient, redirect_uris: updated });
    };

    const removeRedirectUri = (index: number) => {
        const updated = newClient.redirect_uris.filter((_, i) => i !== index);
        setNewClient({ ...newClient, redirect_uris: updated });
    };

    const generateDockerCompose = (client: OAuthClient & { client_secret: string }) => {
        const appName = client.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const redirectUri = client.redirect_uris[0] || 'http://localhost:PORT/oauth2/callback';

        return `version: '3.8'

services:
  # Your Application
  ${appName}:
    image: your-app-image:latest
    container_name: ${appName}
    # Add your app configuration here
    networks:
      - app_network

  # oauth2-proxy for SSO
  ${appName}-auth:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
    container_name: ${appName}-auth
    command:
      - --provider=oidc
      - --oidc-issuer-url=${typeof window !== 'undefined' ? window.location.origin : 'http://atom:3000'}
      - --client-id=${client.client_id}
      - --client-secret=${client.client_secret}
      - --cookie-secret=COOKIE_SECRET_HERE  # Generate with: openssl rand -base64 32
      - --redirect-url=${redirectUri}
      - --upstream=http://${appName}:PORT  # Update with your app's port
      - --email-domain=*
      - --pass-user-headers=true
      - --pass-access-token=true
      - --cookie-secure=false  # Set to true in production with HTTPS
      - --http-address=0.0.0.0:4180
    ports:
      - "PORT:4180"  # Update PORT (e.g., 8080:4180)
    networks:
      - app_network
    depends_on:
      - ${appName}
    restart: unless-stopped

networks:
  app_network:
    driver: bridge`;
    };

    if (loading) {
        return <div className={styles.container}>Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>OAuth2 Applications</h2>
                <button onClick={() => {
                    setEditingClientId(null);
                    setNewClient({ name: '', description: '', redirect_uris: [''], allowed_scopes: ['openid', 'profile'] });
                    setShowAddForm(true);
                }} className={styles.addButton}>
                    <Plus size={18} /> Add Application
                </button>
            </div>

            {/* Show created client credentials */}
            {createdClient && (
                <div className={styles.createdClientCard}>
                    <div className={styles.successBanner}>
                        <CheckCircle2 size={20} />
                        Application created successfully! Save these credentials securely - the client secret won't be shown again.
                    </div>

                    <div className={styles.credentialRow}>
                        <div>
                            <label>Client ID</label>
                            <code>{createdClient.client_id}</code>
                        </div>
                        <button onClick={() => copyToClipboard(createdClient.client_id, 'client_id')}>
                            {copiedField === 'client_id' ? 'Copied!' : <Copy size={16} />}
                        </button>
                    </div>

                    <div className={styles.credentialRow}>
                        <div>
                            <label>Client Secret</label>
                            <code>{createdClient.client_secret}</code>
                        </div>
                        <button onClick={() => copyToClipboard(createdClient.client_secret, 'client_secret')}>
                            {copiedField === 'client_secret' ? 'Copied!' : <Copy size={16} />}
                        </button>
                    </div>

                    <div className={styles.actionButtons}>
                        <button onClick={() => setShowDockerCompose(true)} className={styles.dockerButton}>
                            <FileCode size={16} /> Generate Docker Compose
                        </button>
                        <button onClick={() => setCreatedClient(null)} className={styles.dismissButton}>
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Add Client Form */}
            {showAddForm && (
                <div className={styles.formCard}>
                    <h3>{editingClientId ? 'Edit Application' : 'New Application'}</h3>

                    <div className={styles.formGroup}>
                        <label>Application Name *</label>
                        <input
                            type="text"
                            value={newClient.name}
                            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                            placeholder="My Application"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Description</label>
                        <input
                            type="text"
                            value={newClient.description}
                            onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                            placeholder="Optional description"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Redirect URIs *</label>
                        {newClient.redirect_uris.map((uri, index) => (
                            <div key={index} className={styles.uriRow}>
                                <input
                                    type="url"
                                    value={uri}
                                    onChange={(e) => updateRedirectUri(index, e.target.value)}
                                    placeholder="https://example.com/callback"
                                />
                                {newClient.redirect_uris.length > 1 && (
                                    <button onClick={() => removeRedirectUri(index)} className={styles.removeButton}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={addRedirectUri} className={styles.addUriButton}>
                            + Add Redirect URI
                        </button>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Allowed Scopes *</label>
                        <div className={styles.scopeSelector}>
                            {['openid', 'profile', 'username', 'email'].map(scope => (
                                <label key={scope} className={styles.scopeCheckbox}>
                                    <input
                                        type="checkbox"
                                        checked={newClient.allowed_scopes.includes(scope)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setNewClient({
                                                    ...newClient,
                                                    allowed_scopes: [...newClient.allowed_scopes, scope]
                                                });
                                            } else {
                                                setNewClient({
                                                    ...newClient,
                                                    allowed_scopes: newClient.allowed_scopes.filter(s => s !== scope)
                                                });
                                            }
                                        }}
                                    />
                                    <span>{scope}</span>
                                </label>
                            ))}
                        </div>
                        <p className={styles.hint}>Select which scopes this application can request. 'openid' is required for OIDC.</p>
                    </div>

                    <div className={styles.formActions}>
                        <button onClick={handleCancel} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button onClick={handleSaveClient} className={styles.saveButton}>
                            {editingClientId ? 'Save Changes' : 'Create Application'}
                        </button>
                    </div>
                </div>
            )}

            {/* Client List */}
            {clients.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No OAuth2 applications configured</p>
                    <p className={styles.emptyHint}>Add an application to enable SSO authentication</p>
                </div>
            ) : (
                <div className={styles.clientList}>
                    {clients.map((client) => (
                        <div key={client.id} className={styles.clientCard}>
                            <div className={styles.clientHeader}>
                                <div>
                                    <h4>{client.name}</h4>
                                    {client.description && <p>{client.description}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleEditClient(client)}
                                        className={styles.deleteButton}
                                        style={{ color: 'var(--text-primary)', background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
                                        title="Edit application"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClient(client.client_id)}
                                        className={styles.deleteButton}
                                        title="Delete application"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className={styles.clientDetails}>
                                <div className={styles.detailRow}>
                                    <span>Client ID:</span>
                                    <code>{client.client_id}</code>
                                    <button onClick={() => copyToClipboard(client.client_id, `${client.id}_id`)}>
                                        {copiedField === `${client.id}_id` ? 'Copied!' : <Copy size={14} />}
                                    </button>
                                </div>

                                <div className={styles.detailRow}>
                                    <span>Scopes:</span>
                                    <div className={styles.scopes}>
                                        {client.allowed_scopes.map(scope => (
                                            <span key={scope} className={styles.scope}>{scope}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.detailRow}>
                                    <span>Redirect URIs:</span>
                                    <div className={styles.uris}>
                                        {client.redirect_uris.map((uri, idx) => (
                                            <code key={idx}>{uri}</code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Docker Compose Modal */}
            {showDockerCompose && createdClient && (
                <div className={styles.modal} onClick={() => setShowDockerCompose(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Docker Compose Configuration</h3>
                            <button onClick={() => setShowDockerCompose(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <p>Use this docker-compose configuration to deploy oauth2-proxy with your application:</p>
                            <div className={styles.codeBlock}>
                                <button
                                    className={styles.copyCodeButton}
                                    onClick={() => copyToClipboard(generateDockerCompose(createdClient), 'docker-compose')}
                                >
                                    {copiedField === 'docker-compose' ? 'Copied!' : <Copy size={16} />}
                                </button>
                                <pre><code>{generateDockerCompose(createdClient)}</code></pre>
                            </div>
                            <div className={styles.setupSteps}>
                                <h4>Setup Steps:</h4>
                                <ol>
                                    <li>Generate cookie secret: <code>openssl rand -base64 32</code></li>
                                    <li>Replace <code>COOKIE_SECRET_HERE</code> with the generated value</li>
                                    <li>Update <code>redirect-url</code> with your actual domain</li>
                                    <li>Deploy: <code>docker-compose up -d</code></li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
