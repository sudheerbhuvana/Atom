'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Grid3X3, Grid2X2, List as ListIcon } from 'lucide-react';
import ServiceCard from './ServiceCard';
import SystemStatsWidget from './SystemStats';
import DockerWidget from './DockerWidget';
import ShortcutsModal from './ShortcutsModal';
import ClockWidget from './ClockWidget';
import { useStatus } from '@/context/StatusContext';
import styles from './Dashboard.module.css';

import { useConfig } from '@/context/ConfigContext';


export default function Dashboard() {
    const { config, updateConfig, loading } = useConfig();
    const [search, setSearch] = useState('');
    const [layout, setLayout] = useState<'list' | 'grid4' | 'grid6'>('grid6');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const { refreshAll, checkMany } = useStatus();

    // Initial Status Check
    useEffect(() => {
        if (!config?.services) return;
        const urls = config.services.map(s => s.url);
        // Fire and forget, context handles throttling
        checkMany(urls);
    }, [config?.services, checkMany]);

    const handleLayoutChange = (newLayout: 'list' | 'grid4' | 'grid6') => {
        if (!config) return;

        setLayout(newLayout); // Optimistic UI

        const newConfig = { ...config };
        if (!newConfig.layout) newConfig.layout = { columns: 6, gap: 16 };

        if (newLayout === 'list') {
            newConfig.layout.style = 'list';
        } else {
            newConfig.layout.style = 'grid';
            newConfig.layout.columns = newLayout === 'grid4' ? 4 : 6;
        }

        updateConfig(newConfig);
    };

    const handleRefresh = async () => {
        if (!config) return;
        const urls = config.services.map(s => s.url);
        await refreshAll(urls);
    };

    if (loading || !config) return <div className={styles.loader}>Loading...</div>;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const filteredServices = config.services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase())
    );

    const getSearchUrl = (query: string) => {
        const searchEngines: { [key: string]: string } = {
            'Google': `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            'DuckDuckGo': `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            'Bing': `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        };
        return searchEngines[config.searchEngine || 'Google'] || searchEngines['Google'];
    };

    const filteredLinks = config.links.filter(l =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.url.toLowerCase().includes(search.toLowerCase())
    );

    const hasResults = filteredServices.length > 0 || filteredLinks.length > 0;

    const containerClass = config.layout?.containerWidth === 'full'
        ? styles.wrapperFull
        : config.layout?.containerWidth === 'compact'
            ? styles.wrapperCompact
            : styles.wrapper;

    return (
        <div className={containerClass}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.greeting}>
                    <div className={styles.date}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <h1 className={styles.title}>
                        {config.title || 'Atom'}
                    </h1>
                    <p className={styles.subtitle}>
                        {getGreeting()}, {config.user?.name || 'User'}!
                    </p>
                </div>
                <ClockWidget
                    weatherLocation={config.weather?.location}
                    onShowShortcuts={() => setShowShortcuts(true)}
                    onRefresh={handleRefresh}
                />
            </header>

            {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

            {/* Search */}
            <div className={styles.searchBar}>
                <Search className={styles.searchIcon} size={20} />
                <input
                    ref={searchRef}
                    placeholder={`Search ${config.searchEngine || 'Google'}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <span className={styles.searchHint}>{config.searchEngine || 'Google'} &gt;</span>
            </div>

            {/* Content Grid */}
            <div className={`${styles.contentGrid} ${config.layout?.showWidgets === false ? styles.fullWidth : ''}`}>
                {/* Left Col: Widgets (Conditional) */}
                {config.layout?.showWidgets !== false && (
                    <div className={styles.leftCol}>
                        {config.widgets?.map(widget => (
                            <div key={widget.id} style={{ marginBottom: '2rem' }}>
                                <h2 className={styles.sectionHeader}>{widget.title || 'Widget'}</h2>
                                {widget.type === 'system-monitor' && <SystemStatsWidget />}
                            </div>
                        ))}
                        {/* Fallback if widgets array is missing but showWidgets is true/undefined */}
                        {(!config.widgets || config.widgets.length === 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <h2 className={styles.sectionHeader}>System Monitor</h2>
                                    <SystemStatsWidget />
                                </div>
                                <div>
                                    <h2 className={styles.sectionHeader}>Docker</h2>
                                    <DockerWidget />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Right Col: Applications & Bookmarks */}
                <div className={styles.rightCol}>

                    {/* Applications Section */}
                    {(filteredServices.length > 0 || !search) && (
                        <div style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 className={styles.sectionHeader} style={{ marginBottom: 0 }}>Applications</h2>
                                <div className={styles.layoutControls}>
                                    <button
                                        className={`${styles.layoutBtn} ${layout === 'grid6' ? styles.active : ''}`}
                                        onClick={() => handleLayoutChange('grid6')}
                                        title="Small Cards (6 per row)"
                                    >
                                        <Grid3X3 size={18} />
                                    </button>
                                    <button
                                        className={`${styles.layoutBtn} ${layout === 'grid4' ? styles.active : ''}`}
                                        onClick={() => handleLayoutChange('grid4')}
                                        title="Large Cards (4 per row)"
                                    >
                                        <Grid2X2 size={18} />
                                    </button>
                                    <button
                                        className={`${styles.layoutBtn} ${layout === 'list' ? styles.active : ''}`}
                                        onClick={() => handleLayoutChange('list')}
                                        title="List View"
                                    >
                                        <ListIcon size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className={`${styles.appList} ${styles[layout]}`}>
                                {filteredServices.map(service => (
                                    <ServiceCard
                                        key={service.id}
                                        service={service}
                                        compact={config.layout?.fullSizeButtons === false}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bookmarks Section */}
                    {(filteredLinks.length > 0 || (!search && config.links.length > 0)) && (
                        <div style={{ marginBottom: '3rem' }}>
                            <h2 className={styles.sectionHeader} style={{ marginBottom: '1.5rem' }}>Bookmarks</h2>
                            <div className={`${styles.appList} ${styles[layout]}`}>
                                {filteredLinks.map(link => (
                                    <ServiceCard
                                        key={link.id}
                                        service={{ ...link, name: link.title, category: 'Bookmark' }}
                                        compact={config.layout?.fullSizeButtons === false}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty Search State */}
                    {!hasResults && search.trim() !== '' && (
                        <div className={styles.emptyState}>
                            <p>No results found for &quot;{search}&quot;</p>
                            <a
                                href={getSearchUrl(search)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.searchWebBtn}
                            >
                                <Search size={14} />
                                Search on {config.searchEngine || 'Google'}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
