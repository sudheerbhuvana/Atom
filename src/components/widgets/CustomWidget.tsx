'use client';

import React, { useEffect, useState } from 'react';
import WidgetContainer from './WidgetContainer';
import * as LucideIcons from 'lucide-react';

export interface CustomWidgetProps {
    title: string;
    endpoint: string;
    template: string;
    styles: string;
    script?: string;
    refreshInterval?: number;
    icon?: string;
}

export default function CustomWidget({
    title,
    endpoint,
    template,
    styles,
    script,
    icon,
    refreshInterval = 10000
}: CustomWidgetProps) {
    console.log('Rendering Custom Widget:', title); // Debug Log
    const [data, setData] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const IconComponent = icon ? (LucideIcons as unknown as Record<string, React.ElementType>)[icon] : null;

    useEffect(() => {
        const fetchData = async () => {
            if (!endpoint) return;
            try {
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(endpoint)}`;
                const res = await fetch(proxyUrl);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const json = await res.json();
                setData(json);
                setError(null);
            } catch (err) {
                console.error(`Fetch error for ${title}:`, err);
                setError('Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [endpoint, refreshInterval, title]);

    // Simple template engine
    const renderTemplate = () => {
        if (!data) return '';

        let html = '';

        // Helper to replace variables in a string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const replaceVars = (tmpl: string, context: any) => {
            return tmpl.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
                const keys = path.trim().split('.');
                let value = context;
                for (const key of keys) {
                    value = value?.[key];
                }
                return value !== undefined && value !== null ? String(value) : '';
            });
        };

        if (Array.isArray(data)) {
            // Auto-loop for root arrays
            // We basically treat the whole template as the item template
            html = data.map(item => replaceVars(template, item)).join('');
        } else {
            // Single object rendering
            html = replaceVars(template, data);
        }

        return html;
    };

    const widgetId = `custom-widget-${title.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`;

    useEffect(() => {
        if (!script || !data) return;

        try {
            const fn = new Function('data', 'element', script);
            const containerElement = document.getElementById(widgetId);
            if (containerElement) {
                fn(data, containerElement);
            }
        } catch (err) {
            console.error('Custom widget script error:', err);
        }
    }, [data, script, widgetId]);

    if (loading && !data && !error) {
        return (
            <WidgetContainer title={title} icon={IconComponent && <IconComponent size={16} />}>
                <div className="flex items-center justify-center p-4 opacity-50 text-sm">Loading...</div>
            </WidgetContainer>
        );
    }


    return (
        <WidgetContainer title={title} error={error} icon={IconComponent && <IconComponent size={16} />}>
            <style>
                {`
                    #${widgetId} {
                        width: 100%;
                        overflow: hidden;
                    }
                    /* Prefix user styles with ID to scope them roughly */
                    #${widgetId} .custom-content {
                        ${styles}
                    }
                    /* Allow user to write normal css if they target specific classes inside */
                `}
            </style>
            <div id={widgetId}>
                {/* We wrap user content in a scoped style block approach or just direct injection */}
                <style dangerouslySetInnerHTML={{ __html: styles }} />
                <div
                    className="custom-content"
                    dangerouslySetInnerHTML={{ __html: renderTemplate() }}
                />
            </div>
        </WidgetContainer>
    );
}
