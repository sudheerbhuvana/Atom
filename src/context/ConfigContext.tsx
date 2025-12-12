'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppConfig } from '@/types';
import { toast } from 'sonner';

interface ConfigContextType {
    config: AppConfig | null;
    loading: boolean;
    refreshConfig: () => Promise<void>;
    updateConfig: (newConfig: AppConfig) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/config', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch config');
            const data = await res.json();
            setConfig(data);
        } catch (error) {
            console.error('Failed to load config:', error);
            toast.error('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateConfig = useCallback(async (newConfig: AppConfig) => {
        // Optimistic update
        setConfig(newConfig);

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
            if (!res.ok) throw new Error('Failed to save config');
        } catch (error) {
            console.error('Failed to save config:', error);
            toast.error('Failed to save changes');
            // Revert on failure (optional, but good practice. For now simpler to just warn)
            refreshConfig();
        }
    }, [refreshConfig]);

    useEffect(() => {
        refreshConfig();
    }, [refreshConfig]);

    return (
        <ConfigContext.Provider value={{ config, loading, refreshConfig, updateConfig }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}
