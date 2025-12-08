'use client';


export default function Dashboard() {
    const { config, updateConfig, loading } = useConfig();
    const [search, setSearch] = useState('');
    const [layout, setLayout] = useState<'list' | 'grid4' | 'grid6'>('grid6');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { refreshAll, checkMany } = useStatus();

    // Initial Status Check
    useEffect(() => {
        if (!config?.services) return;
        const urls = config.services.map(s => s.url);
        // Fire and forget, context handles throttling
        checkMany(urls);
    }, [config?.services, checkMany]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                // Escape to blur search
                if (e.key === 'Escape') {
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            switch (e.key) {
                case '/':
                    e.preventDefault();
                    searchRef.current?.focus();
                    break;
                case '?':
                    setShowShortcuts(prev => !prev);
                    break;
                case 's':
                case 'S':
                    router.push('/settings');
                    break;
                case '1':
                    handleLayoutChange('grid6');
                    break;
                case '2':
                    handleLayoutChange('grid4');
                    break;
                case '3':
                    handleLayoutChange('list');
                    break;
                case 'Escape':
                    setShowShortcuts(false);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router, config]); // config dep is fine, context updates it


    // Set initial layout from config
    useEffect(() => {
        if (config) {
            if (config.layout?.style === 'list') {
                setLayout('list');
            } else if (config.layout?.columns === 4) {
                setLayout('grid4');
            } else {
                setLayout('grid6');
            }
        }
    }, [config]);

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
                        placeholder={`Search ${config.searchEngine || 'Google'}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                />
                        <span className={styles.searchHint}>{config.searchEngine || 'Google'} &gt;</span>
                    </div>

                    {/* Content Grid */}
                    <div className={`${styles.contentGrid} ${config.layout?.showWidgets === false ? styles.fullWidth : ''}`}>
                        <SystemStatsWidget />
                    </div>
                        )}
                </div>
                )
}

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
                            <p>No results found for "{search}"</p>
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
        </div >
        </div >
    );
}
