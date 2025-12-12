export interface Link {
    id: string;
    title: string;
    url: string;
    icon?: string; // Lucide icon name or emoji
}

export interface Service {
    id: string;
    name: string;
    url: string;
    icon?: string;
    category?: string;
    description?: string;
    color?: string; // Optional accent color override
    ping?: string;  // Optional Host/IP for ICMP ping
    createdAt?: number;
    updatedAt?: number;
}

export interface ThemeConfig {
    primaryColor: string;
    backgroundColor: string;
    backgroundImage?: string;
    mode?: 'light' | 'dark';
}

export interface AppConfig {
    title: string;
    theme: ThemeConfig;
    services: Service[];
    links: Link[];
    layout: {
        columns: number;
        gap: number;
        showWidgets?: boolean;
        fullSizeButtons?: boolean;
        style?: 'list' | 'grid';
        containerWidth?: 'full' | 'centered' | 'compact';
    };
    searchEngine?: string; // 'google', 'duckduckgo', etc.
    user?: {
        name: string;
    };
    weather?: {
        location: string; // e.g. "Hyderabad", "London"
        lat?: number;
        long?: number;
    };
    widgets?: Widget[];
}

export interface Widget {
    id: string;
    type: 'system-monitor' | 'weather' | 'clock' | 'generic' | 'docker'; // Add more types later
    title?: string;
    options?: Record<string, unknown>;
}

export interface SystemStats {
    cpuLoad: number;
    memTotal: number;
    memUsed: number;
    uptime: number;
    platform: string;
    storage: {
        fs: string;
        size: number;
        used: number;
    }[];
}

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    cpu?: number;
    memory?: string;
    memPercent?: number;
    ports: string;
}
