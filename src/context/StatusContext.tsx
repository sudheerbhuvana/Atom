'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ServiceStatus = {
    state: 'loading' | 'up' | 'down' | 'slow';
    code: number;
    latency: number;
    lastUpdated: number;
};

interface StatusContextType {
    statuses: Record<string, ServiceStatus>;
    checkStatus: (service: { id: string, url: string, ping?: string }, force?: boolean) => Promise<void>;
    checkMany: (services: { id: string, url: string, ping?: string }[], concurrency?: number, force?: boolean) => Promise<void>;
    refreshAll: (services: { id: string, url: string, ping?: string }[]) => Promise<void>;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export function StatusProvider({ children }: { children: ReactNode }) {
    const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
    const statusesRef = React.useRef(statuses);

    // Keep ref in sync with state
    React.useEffect(() => {
        statusesRef.current = statuses;
    }, [statuses]);

    // Helper: Single status check (direct network call)
    const fetchStatusSingle = async (service: { url: string, ping?: string }) => {
        try {
            let endpoint = '';

            if (service.ping) {
                endpoint = `/api/status/ping?host=${encodeURIComponent(service.ping)}`;
            } else {
                if (!service.url.startsWith('http')) return { state: 'down', code: 0, latency: 0, lastUpdated: Date.now() } as ServiceStatus;
                endpoint = `/api/status/check?url=${encodeURIComponent(service.url)}`;
            }

            const res = await fetch(endpoint);
            const data = await res.json();

            if (service.ping) {
                // Ping response: { alive, time }
                return {
                    state: data.alive ? (data.time > 200 ? 'slow' : 'up') : 'down',
                    code: data.alive ? 200 : 0,
                    latency: data.time || 0,
                    lastUpdated: Date.now()
                } as ServiceStatus;
            } else {
                // HTTP response: { up, status, latency }
                return {
                    state: data.up ? (data.latency > 200 ? 'slow' : 'up') : 'down',
                    code: data.status,
                    latency: data.latency,
                    lastUpdated: Date.now()
                } as ServiceStatus;
            }
        } catch {
            return { state: 'down', code: 0, latency: 0, lastUpdated: Date.now() } as ServiceStatus;
        }
    };

    const checkStatus = useCallback(async (service: { id: string, url: string, ping?: string }, force = false) => {
        const key = service.id || service.url;
        const current = statusesRef.current[key];
        const FLASH_CACHE_MS = 1000 * 60 * 5; // 5 Minutes

        if (!force && current && (Date.now() - current.lastUpdated < FLASH_CACHE_MS)) {
            return;
        }

        // Optimistically set loading (check if needed to avoid flicker if already loading)
        if (!current || current.state !== 'loading') {
            setStatuses(prev => ({
                ...prev,
                [key]: { ...prev[key], state: 'loading' }
            }));
        }

        const data = await fetchStatusSingle(service);
        setStatuses(prev => ({ ...prev, [key]: data }));
    }, []); // No dependencies needed now

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const checkMany = useCallback(async (services: { id: string, url: string, ping?: string }[], _concurrency = 5, force = false) => {
        // Filter out items that are already fresh
        const servicesToFetch = services.filter(s => {
            if (force) return true;
            // Skip malformed
            if (!s.ping && !s.url.startsWith('http')) return false;

            const key = s.id || s.url;
            const current = statusesRef.current[key];
            const FLASH_CACHE_MS = 1000 * 60 * 5; // 5 Minutes
            if (current && (Date.now() - current.lastUpdated < FLASH_CACHE_MS)) {
                return false;
            }
            return true;
        });

        if (servicesToFetch.length === 0) return;

        // Mark as loading
        setStatuses(prev => {
            const next = { ...prev };
            let hasChanges = false;
            servicesToFetch.forEach(s => {
                const key = s.id || s.url;
                if (!next[key] || next[key].state !== 'loading') {
                    next[key] = { ...(next[key] || {}), state: 'loading', code: 0, latency: 0, lastUpdated: Date.now() };
                    hasChanges = true;
                }
            });
            return hasChanges ? next : prev;
        });

        // Separate Ping vs HTTP for batching
        const httpServices = servicesToFetch.filter(s => !s.ping && s.url.startsWith('http'));
        const pingServices = servicesToFetch.filter(s => !!s.ping);

        // 1. Handle HTTP Batch
        if (httpServices.length > 0) {
            try {
                // Map to unique URLs for the API
                const urls = [...new Set(httpServices.map(s => s.url))];

                const res = await fetch('/api/status/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls })
                });
                const data = await res.json();

                if (data.results) {
                    setStatuses(prev => {
                        const next = { ...prev };
                        Object.entries(data.results).forEach(([url, result]: [string, unknown]) => {
                            const res = result as { up: boolean; status: number; latency: number };
                            // We need to map back to IDs. 
                            httpServices.filter(s => s.url === url).forEach(s => {
                                const key = s.id || s.url;
                                next[key] = {
                                    state: res.up ? (res.latency > 200 ? 'slow' : 'up') : 'down',
                                    code: res.status,
                                    latency: res.latency,
                                    lastUpdated: Date.now()
                                };
                            });
                        });
                        return next;
                    });
                }
            } catch (e) {
                console.error("Batch fetch failed", e);
            }
        }

        // 2. Handle Pings (Parallel)
        await Promise.all(pingServices.map(async (s) => {
            const result = await fetchStatusSingle(s);
            setStatuses(prev => ({
                ...prev,
                [s.id || s.url]: result
            }));
        }));

    }, []); // No dependencies needed now

    const refreshAll = useCallback(async (services: { id: string, url: string, ping?: string }[]) => {
        return checkMany(services, 5, true);
    }, [checkMany]);

    return (
        <StatusContext.Provider value={{ statuses, checkStatus, checkMany, refreshAll }}>
            {children}
        </StatusContext.Provider>
    );
}

export function useStatus() {
    const context = useContext(StatusContext);
    if (context === undefined) {
        throw new Error('useStatus must be used within a StatusProvider');
    }
    return context;
}
