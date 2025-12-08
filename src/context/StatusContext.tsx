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
    checkStatus: (url: string, force?: boolean) => Promise<void>;
    checkMany: (urls: string[], concurrency?: number, force?: boolean) => Promise<void>;
    refreshAll: (urls: string[]) => Promise<void>;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export function StatusProvider({ children }: { children: ReactNode }) {
    const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});

    // Helper: Single status check (direct network call)
    // Used by checkStatus or as fallback
    const fetchStatusSingle = async (url: string) => {
        try {
            const res = await fetch(`/api/status/check?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            return {
                state: data.up ? (data.latency > 200 ? 'slow' : 'up') : 'down',
                code: data.status,
                latency: data.latency,
                lastUpdated: Date.now()
            } as ServiceStatus;
        } catch (e) {
            return { state: 'down', code: 0, latency: 0, lastUpdated: Date.now() } as ServiceStatus;
        }
    };

    const checkStatus = useCallback(async (url: string, force = false) => {
        // Skip if not http/https
        if (!url.startsWith('http')) return;

        const current = statuses[url];
        const FLASH_CACHE_MS = 1000 * 60 * 5; // 5 Minutes

        if (!force && current && (Date.now() - current.lastUpdated < FLASH_CACHE_MS)) {
            return;
        }

        if (!current) {
            setStatuses(prev => ({
                ...prev,
                [url]: { state: 'loading', code: 0, latency: 0, lastUpdated: Date.now() }
            }));
        }

        const data = await fetchStatusSingle(url);
        setStatuses(prev => ({ ...prev, [url]: data }));
    }, [statuses]);

    const checkMany = useCallback(async (urls: string[], concurrency = 5, force = false) => {
        const uniqueUrls = [...new Set(urls.filter(u => u.startsWith('http')))];

        // Filter out URLs that are already fresh if force is false
        const urlsToFetch = uniqueUrls.filter(url => {
            if (force) return true;
            const current = statuses[url];
            const FLASH_CACHE_MS = 1000 * 60 * 5; // 5 Minutes
            if (current && (Date.now() - current.lastUpdated < FLASH_CACHE_MS)) {
                return false;
            }
            return true;
        });

        if (urlsToFetch.length === 0) return;

        // Mark as loading
        setStatuses(prev => {
            const next = { ...prev };
            let changed = false;
            urlsToFetch.forEach(url => {
                if (force || !next[url]) {
                    next[url] = { state: 'loading', code: 0, latency: 0, lastUpdated: Date.now() };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });

        // Use Batch API
        try {
            const res = await fetch('/api/status/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: urlsToFetch })
            });
            const data = await res.json();

            if (data.results) {
                setStatuses(prev => {
                    const next = { ...prev };
                    Object.entries(data.results).forEach(([url, result]: [string, any]) => {
                        next[url] = {
                            state: result.up ? (result.latency > 200 ? 'slow' : 'up') : 'down',
                            code: result.status,
                            latency: result.latency,
                            lastUpdated: Date.now()
                        };
                    });
                    return next;
                });
            }
        } catch (e) {
            console.error("Batch fetch failed", e);
            setStatuses(prev => {
                const next = { ...prev };
                urlsToFetch.forEach(url => {
                    // Fallback to down or keep loading? Down prevents infinite load.
                    next[url] = { state: 'down', code: 0, latency: 0, lastUpdated: Date.now() };
                });
                return next;
            });
        }
    }, [statuses]);

    const refreshAll = useCallback(async (urls: string[]) => {
        return checkMany(urls, 5, true);
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
