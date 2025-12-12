export interface WidgetPreset {
    id: string;
    name: string;
    type: 'generic';
    description: string;
    icon: string;
    defaultOptions: {
        endpoint: string;
        fields: { label: string; path: string; suffix?: string; format?: string }[];
    }
}

export const WIDGET_PRESETS: WidgetPreset[] = [
    {
        id: 'sonarr-queue',
        name: 'Sonarr (Queue)',
        type: 'generic',
        description: 'Displays current download queue size from Sonarr',
        icon: 'hard-drive',
        defaultOptions: {
            endpoint: 'http://localhost:8989/api/v3/queue?apikey=YOUR_API_KEY',
            fields: [
                { label: 'Queue', path: 'totalRecords', suffix: '' }
            ]
        }
    },
    {
        id: 'radarr-queue',
        name: 'Radarr (Queue)',
        type: 'generic',
        description: 'Displays current download queue size from Radarr',
        icon: 'film',
        defaultOptions: {
            endpoint: 'http://localhost:7878/api/v3/queue?apikey=YOUR_API_KEY',
            fields: [
                { label: 'Queue', path: 'totalRecords', suffix: '' }
            ]
        }
    },
    {
        id: 'pihole-summary',
        name: 'Pi-hole (Summary)',
        type: 'generic',
        description: 'Comprehensive DNS blocking statistics',
        icon: 'shield',
        defaultOptions: {
            endpoint: 'http://pi.hole/admin/api.php?summary',
            fields: [
                { label: 'Blocked', path: 'ads_blocked_today', suffix: '' },
                { label: 'Percent', path: 'ads_percentage_today', suffix: '%' },
                { label: 'Total Queries', path: 'dns_queries_today', suffix: '' },
                { label: 'Active Clients', path: 'unique_clients', suffix: '' },
                { label: 'Domain Count', path: 'domains_being_blocked', suffix: '' }
            ]
        }
    },
    {
        id: 'glances-cpu',
        name: 'Glances (CPU)',
        type: 'generic',
        description: 'CPU usage derived from Glances API',
        icon: 'cpu',
        defaultOptions: {
            endpoint: 'http://localhost:61208/api/3/cpu',
            fields: [
                { label: 'Usage', path: 'total', suffix: '%' },
                { label: 'User', path: 'user', suffix: '%' },
                { label: 'System', path: 'system', suffix: '%' }
            ]
        }
    },
    {
        id: 'glances-mem',
        name: 'Glances (Memory)',
        type: 'generic',
        description: 'Memory usage derived from Glances API',
        icon: 'bar-chart',
        defaultOptions: {
            endpoint: 'http://localhost:61208/api/3/mem',
            fields: [
                { label: 'Used', path: 'percent', suffix: '%' },
                { label: 'Free', path: 'free', format: 'bytes' },
                { label: 'Total', path: 'total', format: 'bytes' }
            ]
        }
    },
    {
        id: 'tautulli-activity',
        name: 'Tautulli (Activity)',
        type: 'generic',
        description: 'Plex stream activity and bandwidth from Tautulli',
        icon: 'activity',
        defaultOptions: {
            endpoint: 'http://localhost:8181/api/v2?cmd=get_activity&apikey=YOUR_API_KEY',
            fields: [
                { label: 'Streams', path: 'response.data.stream_count', suffix: '' },
                { label: 'Total BW', path: 'response.data.total_bandwidth', suffix: ' Kbps' },
                { label: 'WAN BW', path: 'response.data.wan_bandwidth', suffix: ' Kbps' },
                { label: 'LAN BW', path: 'response.data.lan_bandwidth', suffix: ' Kbps' }
            ]
        }
    },
    {
        id: 'portainer-stacks',
        name: 'Portainer (Stacks)',
        type: 'generic',
        description: 'Stack count from Portainer (requires auth token/header technically, but generic supports basic api endpoint)',
        icon: 'box',
        defaultOptions: {
            endpoint: 'http://localhost:9000/api/stacks',
            fields: [
                { label: 'Active Stacks', path: 'length', suffix: '' } // Arrays often map length in JS, but generic widget might need specific handling or just count. 'length' path works if widget handles array.length access.
            ]
        }
    }
];
