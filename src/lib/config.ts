
import { AppConfig } from '@/types';
import { getConfig as getDbConfig, saveConfig as saveDbConfig, hasConfig as hasDbConfig } from './db';

const DEFAULT_CONFIG: AppConfig = {
    title: 'Atom',
    theme: { primaryColor: '#d4a574', backgroundColor: '#111111' },
    services: [],
    links: [],
    layout: { columns: 4, gap: 18, showWidgets: true, fullSizeButtons: true, style: 'grid', containerWidth: 'centered' },
    searchEngine: 'Google',
    user: { name: 'User' },
    widgets: [
        { id: 'default-sys', type: 'system-monitor', title: 'System Monitor' },
        { id: 'default-docker', type: 'docker', title: 'Docker Stats' }
    ]
};

// Legacy config path for migration


export async function getConfig(): Promise<AppConfig> {
    try {
        const config = getDbConfig() as AppConfig | null;
        if (!config) {
            // First time - use default config
            saveDbConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
        return config;
    } catch (error) {
        console.error('Failed to read config:', error);
        return DEFAULT_CONFIG;
    }
}

export async function saveConfig(config: AppConfig): Promise<boolean> {
    try {
        saveDbConfig(config);
        return true;
    } catch (error) {
        console.error('Failed to save config:', error);
        return false;
    }
}

export function hasExistingConfig(): boolean {
    return hasDbConfig();
}
