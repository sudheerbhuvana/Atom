'use client';

import { useState, useEffect } from 'react';
import { User, Edit3, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import styles from './UserManagement.module.css';

interface UserData {
    id: number;
    username: string;
    email?: string;
    tags?: string[];
    role?: 'admin' | 'member';
    created_at: string;
}

export default function UserManagement() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPassModal, setShowPassModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    // Form states
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'member'>('member');
    const [tags, setTags] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        username?: string;
        email?: string;
        password?: string;
    }>({});
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Password strength calculator
    const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (pwd.length >= 12) strength++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
        if (/\d/.test(pwd)) strength++;
        if (/[^a-zA-Z\d]/.test(pwd)) strength++;

        if (strength <= 2) return 'weak';
        if (strength <= 3) return 'medium';
        return 'strong';
    };

    // Enhanced validation
    const validateUsername = (value: string): string | undefined => {
        if (!value) return 'Username is required';
        if (value.length < 3) return 'Username must be at least 3 characters';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Username can only contain letters, numbers, underscores, and hyphens';
        return undefined;
    };

    const validateEmail = (value: string): string | undefined => {
        if (!value) return undefined; // Email is optional
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        return undefined;
    };

    const validatePassword = (value: string, isRequired = true): string | undefined => {
        if (!value && isRequired) return 'Password is required';
        if (value && value.length < 8) return 'Password must be at least 8 characters';
        return undefined;
    };

    const handleAddUser = async () => {
        // Validate all fields
        const errors = {
            username: validateUsername(username),
            email: validateEmail(email),
            password: validatePassword(password, true)
        };

        const hasErrors = Object.values(errors).some(e => e !== undefined);
        if (hasErrors) {
            setFieldErrors(errors);
            setError('Please fix the errors above');
            return;
        }

        setFieldErrors({});
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    email,
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                    role
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setUsers([...users, data]);
            setShowAddModal(false);
            resetForm();
            toast.success('User created successfully');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An error occurred');
        }
    };

    const handleDeleteUser = (id: number) => {
        toast('Are you sure you want to delete this user?', {
            action: {
                label: 'Delete',
                onClick: async () => {
                    try {
                        const res = await fetch('/api/users', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id })
                        });

                        if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error);
                        }

                        setUsers(prev => prev.filter(u => u.id !== id));
                        toast.success('User deleted');
                    } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : 'An error occurred');
                    }
                }
            },
            cancel: { label: 'Cancel', onClick: () => { } }
        });
    };

    const handleChangePassword = async () => {
        if (!selectedUser) return;

        // If password is provided, validation check
        if (password && password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        try {
            const body: {
                id: number;
                role: 'admin' | 'member';
                tags: string[];
                password?: string;
            } = {
                id: selectedUser.id,
                role,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            };
            if (password) body.password = password;

            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            // Update local state
            setUsers(users.map(u => u.id === selectedUser.id ? {
                ...u,
                role,
                tags: body.tags
            } : u));

            setShowPassModal(false);
            resetForm();
            toast.success('User updated successfully');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'An error occurred';
            setError(msg);
            toast.error(msg);
        }
    };

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setEmail('');
        setTags('');
        setRole('member');
        setError('');
        setFieldErrors({});
        setPasswordStrength(null);
        setSelectedUser(null);
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.list}>
                {users.map(u => (
                    <div key={u.id} className={styles.userRow}>
                        <div className={styles.userInfo}>
                            <div className={styles.avatarPlaceholder}>
                                <User size={20} className={styles.userIcon} />
                            </div>
                            <div className={styles.userDetails}>
                                <div className={styles.userHeader}>
                                    <span className={styles.username}>{u.username}</span>
                                    <span className={u.role === 'admin' ? styles.adminBadge : styles.roleBadge}>
                                        {u.role || 'member'}
                                    </span>
                                    {u.tags && u.tags.length > 0 && (
                                        <div className={styles.tags}>
                                            {u.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.userMeta}>
                                    <span className={styles.email}>{u.email || 'No email'}</span>
                                    <span className={styles.dot}>•</span>
                                    <span className={styles.date}>Member since {new Date(u.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.actions}>
                            <button
                                className={styles.actionBtn}
                                onClick={() => {
                                    setSelectedUser(u);
                                    setRole((u.role as 'admin' | 'member') || 'member');
                                    setTags(u.tags?.join(', ') || '');
                                    setShowPassModal(true);
                                    setError('');
                                }}
                                title="Edit User"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteUser(u.id)}
                                title="Delete User"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button className={styles.addBtn} onClick={() => { setShowAddModal(true); resetForm(); }}>
                <Plus size={16} /> Add User
            </button>

            {/* Models */}
            {(showAddModal || showPassModal) && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <div className={styles.header}>
                            <h3>{showAddModal ? 'Add New User' : `Edit ${selectedUser?.username}`}</h3>
                            <button onClick={() => { setShowAddModal(false); setShowPassModal(false); }} className={styles.closeBtn}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.body}>
                            {showAddModal && (
                                <>
                                    <div className={styles.field}>
                                        <label htmlFor="username">Username *</label>
                                        <input
                                            id="username"
                                            autoFocus
                                            value={username}
                                            onChange={e => {
                                                setUsername(e.target.value);
                                                setFieldErrors(prev => ({ ...prev, username: validateUsername(e.target.value) }));
                                            }}
                                            placeholder="Username"
                                            aria-required="true"
                                            aria-invalid={!!fieldErrors.username}
                                            aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                                        />
                                        {fieldErrors.username && (
                                            <span id="username-error" className={styles.fieldError}>{fieldErrors.username}</span>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="email">Email (Optional)</label>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={e => {
                                                setEmail(e.target.value);
                                                setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) }));
                                            }}
                                            placeholder="user@example.com"
                                            aria-invalid={!!fieldErrors.email}
                                            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                                        />
                                        {fieldErrors.email && (
                                            <span id="email-error" className={styles.fieldError}>{fieldErrors.email}</span>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className={styles.field}>
                                <label htmlFor="role">Role</label>
                                <select
                                    id="role"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                                    className={styles.select}
                                    aria-label="User role"
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="tags">Tags (Optional)</label>
                                <input
                                    id="tags"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    placeholder="admin, dev, finance"
                                    aria-describedby="tags-hint"
                                />
                                <span id="tags-hint" className={styles.hint}>Comma-separated tags for access control</span>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="password">Password {showAddModal ? '*' : '(Leave blank to keep current)'}</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={e => {
                                        setPassword(e.target.value);
                                        if (e.target.value) {
                                            setPasswordStrength(calculatePasswordStrength(e.target.value));
                                            setFieldErrors(prev => ({ ...prev, password: validatePassword(e.target.value, showAddModal) }));
                                        } else {
                                            setPasswordStrength(null);
                                            setFieldErrors(prev => ({ ...prev, password: undefined }));
                                        }
                                    }}
                                    placeholder={showAddModal ? "New Password" : "New Password (Optional)"}
                                    aria-required={showAddModal ? 'true' : 'false'}
                                    aria-invalid={!!fieldErrors.password}
                                    aria-describedby={`${fieldErrors.password ? 'password-error ' : ''}password-requirements`}
                                />
                                {fieldErrors.password && (
                                    <span id="password-error" className={styles.fieldError}>{fieldErrors.password}</span>
                                )}
                                {password && passwordStrength && (
                                    <div className={styles.passwordStrength}>
                                        <div className={`${styles.strengthBar} ${styles[passwordStrength]}`}>
                                            <div className={styles.strengthFill} />
                                        </div>
                                        <span className={styles.strengthLabel} style={{
                                            color: passwordStrength === 'weak' ? '#ef4444' : passwordStrength === 'medium' ? '#f59e0b' : '#10b981'
                                        }}>
                                            {passwordStrength === 'weak' ? '⚠️ Weak' : passwordStrength === 'medium' ? '🔸 Medium' : '✅ Strong'}
                                        </span>
                                    </div>
                                )}
                                {showAddModal && (
                                    <div id="password-requirements" className={styles.passwordHint}>
                                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                            Use 8+ characters, mix of uppercase, lowercase, numbers, and symbols for a strong password
                                        </small>
                                    </div>
                                )}
                            </div>
                            {error && <div className={styles.error}>{error}</div>}
                        </div>

                        <div className={styles.footer}>
                            <button className={styles.cancelBtn} onClick={() => { setShowAddModal(false); setShowPassModal(false); }}>Cancel</button>
                            <button
                                className={styles.saveBtn}
                                onClick={showAddModal ? handleAddUser : handleChangePassword}
                            >
                                {showAddModal ? 'Create User' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
