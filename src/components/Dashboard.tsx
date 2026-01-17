'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Grid3X3, Grid2X2, List as ListIcon, ChevronRight, Edit2, Check } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import ServiceCard from './ui/ServiceCard';
import SystemStatsWidget from './widgets/SystemStats';
import CustomWidget from './widgets/CustomWidget';
import DockerWidget from './widgets/DockerWidget';
import ShortcutsModal from './modals/ShortcutsModal';
import ClockWidget from './widgets/ClockWidget';
import { useStatus } from '@/context/StatusContext';
import GenericWidget from './widgets/GenericWidget';
import SortableWidget from './widgets/SortableWidget';
import styles from './Dashboard.module.css';

import { useConfig } from '@/context/ConfigContext';


export default function Dashboard({ user }: { user?: { username: string; tags?: string[]; role?: string } }) {
    const { config, updateConfig, loading } = useConfig();
    const [search, setSearch] = useState('');
    const [layout, setLayout] = useState<'list' | 'grid4' | 'grid6'>('grid6');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { refreshAll, checkMany } = useStatus();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [localWidgets, setLocalWidgets] = useState<any[]>([]);

    useEffect(() => {
        if (config?.widgets) {
            setLocalWidgets(config.widgets);
        }
    }, [config?.widgets]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const { setNodeRef: setLeftNodeRef } = useDroppable({ id: 'left-column-droppable' });
    const { setNodeRef: setRightNodeRef } = useDroppable({ id: 'right-column-droppable' });

    const leftWidgets = localWidgets.filter(w => (w.column !== 'right') && (isEditMode || w.enabled !== false));
    const rightWidgets = localWidgets.filter(w => (w.column === 'right') && (isEditMode || w.enabled !== false));

    const handleDragOver = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Find the containers
        const activeWidget = localWidgets.find(w => w.id === activeId);
        const overWidget = localWidgets.find(w => w.id === overId);

        if (!activeWidget) return;

        let newColumn: 'left' | 'right' = activeWidget.column || 'left';

        // Check if over a column drop zone
        if (overId === 'right-column-droppable') {
            newColumn = 'right';
        } else if (overId === 'left-column-droppable') {
            newColumn = 'left';
        } else if (overWidget) {
            // Over another widget, adopt its column
            newColumn = overWidget.column || 'left';
        }

        if (activeWidget.column !== newColumn) {
            setLocalWidgets((items) => {
                return items.map(w =>
                    w.id === activeId ? { ...w, column: newColumn } : w
                );
            });
        }
    };

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Use current localWidgets state from closure (dependency ensures freshness)
        let newItems = [...localWidgets];

        // Handle reordering if dropped over another item
        if (activeId !== overId) {
            const oldIndex = newItems.findIndex((w) => w.id === activeId);
            const newIndex = newItems.findIndex((w) => w.id === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                newItems = arrayMove(newItems, oldIndex, newIndex);
            }
        }

        // Update both local state and backend config
        setLocalWidgets(newItems);
        updateConfig({ ...config!, widgets: newItems });

    }, [localWidgets, config, updateConfig]);


    const handleRemoveWidget = useCallback((id: string) => {
        if (!config?.widgets) return;
        const newWidgets = localWidgets.filter(w => w.id !== id);
        setLocalWidgets(newWidgets);
        updateConfig({ ...config, widgets: newWidgets });
    }, [config, updateConfig, localWidgets]);

    const handleMoveSide = useCallback((id: string) => {
        if (!config?.widgets) return;
        const newWidgets = localWidgets.map(w => {
            if (w.id === id) {
                return { ...w, column: w.column === 'right' ? 'left' : 'right' };
            }
            return w;
        });
        setLocalWidgets(newWidgets);
        updateConfig({ ...config, widgets: newWidgets });
    }, [config, updateConfig, localWidgets]);

    const handleToggleWidget = useCallback((id: string) => {
        if (!config?.widgets) return;
        const newWidgets = localWidgets.map(w => {
            if (w.id === id) {
                return { ...w, enabled: w.enabled === false ? true : false };
            }
            return w;
        });
        setLocalWidgets(newWidgets);
        updateConfig({ ...config, widgets: newWidgets });
    }, [config, updateConfig, localWidgets]);



    // Initial Status Check
    useEffect(() => {
        if (!config?.services) return;
        // Fire and forget, context handles throttling
        checkMany(config.services);
    }, [config?.services, checkMany]);

    // Handler functions must be declared before effects that use them
    const handleLayoutChange = useCallback((newLayout: 'list' | 'grid4' | 'grid6') => {
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
    }, [config, updateConfig]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement) return;

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
    }, [router, config, handleLayoutChange]);


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



    const handleRefresh = async () => {
        if (!config) return;
        await refreshAll(config.services);
    };

    if (loading || !config) return <div className={styles.loader}>Loading...</div>;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const userTags = user?.tags || [];
    const hasAllAccess = userTags.includes('all') || user?.role === 'admin';

    const filteredServices = config.services.filter(s => {
        // Tag Access Control
        if (!hasAllAccess) {
            const serviceTags = s.tags || [];
            if (serviceTags.length > 0) {
                const hasMatchingTag = serviceTags.some(t => userTags.includes(t));
                if (!hasMatchingTag) return false;
            }
        }

        // Search Filter
        return s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.url.toLowerCase().includes(search.toLowerCase());
    });

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

    const renderWidget = (widget: any) => {
        const currentColumn = widget.column || 'left';
        return (
            <SortableWidget
                key={widget.id}
                id={widget.id}
                isEditMode={isEditMode}
                onRemove={handleRemoveWidget}
                onMove={config.layout?.widgetAlignment === 'both' ? () => handleMoveSide(widget.id) : undefined}
                currentColumn={currentColumn}
                enabled={widget.enabled !== false}
                onToggle={() => handleToggleWidget(widget.id)}
            >
                <div style={{ marginBottom: isEditMode ? 0 : '2rem' }}>
                    <h2 className={styles.sectionHeader}>{widget.title || 'Widget'}</h2>
                    {widget.type === 'system-monitor' && <SystemStatsWidget />}
                    {widget.type === 'generic' && (
                        <GenericWidget
                            title={widget.title || 'Widget'}
                            endpoint={(widget.options as { endpoint?: string })?.endpoint || ''}
                            fields={(widget.options as { fields?: { label: string; path: string; suffix?: string }[] })?.fields || []}
                            refreshInterval={(widget.options as { refreshInterval?: number })?.refreshInterval}
                        />
                    )}
                    {widget.type === 'custom' && (
                        <CustomWidget
                            title=""
                            endpoint={(widget.options as { endpoint?: string })?.endpoint || ''}
                            template={(widget.options as { template?: string })?.template || ''}
                            styles={(widget.options as { styles?: string })?.styles || ''}
                            script={(widget.options as { script?: string })?.script || ''}
                            refreshInterval={(widget.options as { refreshInterval?: number })?.refreshInterval}
                        />
                    )}
                    {widget.type === 'docker' && <DockerWidget />}
                </div>
            </SortableWidget>
        )
    };


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
                        {getGreeting()}, {user?.username || config.user?.name || 'User'}!
                    </p>
                </div>

                <ClockWidget
                    weatherLocation={config.weather?.location}
                    onShowShortcuts={() => setShowShortcuts(true)}
                    onRefresh={handleRefresh}
                    customAction={
                        <button
                            className={`${styles.editModeBtn} ${isEditMode ? styles.editModeActive : ''}`}
                            onClick={() => setIsEditMode(!isEditMode)}
                        >
                            {isEditMode ? <Check size={16} /> : <Edit2 size={16} />}
                            {isEditMode ? 'Done' : 'Edit Widgets'}
                        </button>
                    }
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
                <span className={styles.searchHint}>
                    {config.searchEngine || 'Google'} <ChevronRight size={14} style={{ opacity: 0.5 }} />
                </span>
            </div>

            {/* Content Grid */}
            <div className={`
                ${styles.contentGrid} 
                ${config.layout?.showWidgets === false ? styles.fullWidth : ''}
                ${config.layout?.widgetAlignment === 'right' ? styles.widgetsRight : ''}
                ${config.layout?.widgetAlignment === 'both' ? styles.widgetsBoth : ''}
            `}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragStart={(e) => setActiveId(e.active.id as string)}
                >
                    {/* Left Col: Widgets (Rendered for Left, Right, and Both) */}
                    {config.layout?.showWidgets !== false && (
                        <div className={styles.leftCol} id="left-column-droppable" ref={setLeftNodeRef}>
                            <SortableContext
                                items={leftWidgets.map(w => w.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {leftWidgets.map(renderWidget)}
                            </SortableContext>

                            {(!config.widgets || config.widgets.length === 0) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className={styles.emptyState} style={{ gridColumn: 'auto', textAlign: 'left', padding: '1rem' }}>
                                        <p>No widgets added.</p>
                                        <a href="/settings" className={styles.settingsBtn}>Configure Widgets</a>
                                    </div>
                                </div>
                            )}

                            {isEditMode && leftWidgets.length === 0 && config.widgets && config.widgets.length > 0 && (
                                <div style={{ padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    Left Side
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right Col: Widgets (Only for Both) */}
                    {config.layout?.showWidgets !== false && config.layout?.widgetAlignment === 'both' && (
                        <div className={styles.rightWidgetCol} id="right-column-droppable" ref={setRightNodeRef}>
                            <SortableContext
                                items={rightWidgets.map(w => w.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {rightWidgets.map(renderWidget)}
                            </SortableContext>
                            {isEditMode && rightWidgets.length === 0 && (
                                <div style={{ padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    Right Side
                                </div>
                            )}
                        </div>
                    )}

                    <DragOverlay>
                        {activeId ? (
                            <div style={{ opacity: 0.8, transform: 'scale(1.05)' }}>
                                {(() => {
                                    const widget = localWidgets.find(w => w.id === activeId);
                                    if (!widget) return null;
                                    return (
                                        <div className={styles.widgetCard} style={{ margin: 0, pointerEvents: 'none' }}>
                                            <h2 className={styles.sectionHeader}>{widget.title || 'Widget'}</h2>
                                            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                                Dragging {widget.title || 'Widget'}...
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

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
                                {filteredServices.length > 0 ? (
                                    filteredServices.map(service => (
                                        <ServiceCard
                                            key={service.id}
                                            service={service}
                                            compact={config.layout?.fullSizeButtons === false}
                                        />
                                    ))
                                ) : (
                                    <div className={styles.emptyState}>
                                        <p style={{ marginBottom: '0.5rem' }}>No applications configured yet</p>
                                        <a href="/settings" className={styles.searchWebBtn}>
                                            Add applications in Settings
                                        </a>
                                    </div>
                                )}
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
                            <p>No results found for &ldquo;{search}&rdquo;</p>
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
