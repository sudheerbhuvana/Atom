'use client';

import React, { useEffect, useState } from 'react';
import WidgetContainer from './WidgetContainer';
import WidgetBlock from './WidgetBlock';
import * as LucideIcons from 'lucide-react';

export interface FieldMapping {
    label: string;
    path: string; // dot notation e.g. "stats.cpu"
    format?: 'number' | 'bytes' | 'percent' | 'string';
    suffix?: string;
}

export interface GenericWidgetProps {
    title: string;
    icon?: string; // Icon name
    endpoint: string;
    href?: string;
    fields: FieldMapping[];
    refreshInterval?: number;
}

// Helper to safely get nested value
const getNestedValue = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
};

const formatValue = (value: unknown, format?: string, suffix?: string) => {
    if (value === undefined || value === null) return '-';

    let formatted: string | number = (typeof value === 'string' || typeof value === 'number') ? value : String(value);

    if (format === 'bytes') {
        const bytes = Number(value);
        if (isNaN(bytes)) return formatted;
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    } else if (format === 'percent') {
        formatted = `${Number(value).toFixed(1)}%`;
    } else if (format === 'number') {
        formatted = new Intl.NumberFormat().format(Number(value));
    }

    if (suffix) {
        if (suffix.trim() === '>' || suffix.trim() === '->') {
            return (
                <span className="flex items-center gap-1">
                    {formatted} <LucideIcons.ChevronRight size={12} className="opacity-70" />
                </span>
            );
        }
        return (
            <span>
                {formatted}<span className="text-muted-foreground text-[0.8em] ml-0.5">{suffix}</span>
            </span>
        );
    }

    return formatted;
};

export default function GenericWidget({
    title,
    icon,
    endpoint,
    href,
    fields,
    refreshInterval = 10000
}: GenericWidgetProps) {
    const [data, setData] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Resolve Icon
    const IconComponent = icon ? (LucideIcons as unknown as Record<string, React.ElementType>)[icon] : null;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use internal proxy to avoid CORS issues
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(endpoint)}`;
                const res = await fetch(proxyUrl, { credentials: 'include' });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const json = await res.json();
                setData(json);
                setError(null);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`Failed to fetch widget data for ${title}:`, err);
                setError(errorMessage || 'Fetch failed');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [endpoint, refreshInterval, title]);

    if (loading && !data && !error) {
        return (
            <WidgetContainer title={title} icon={IconComponent && <IconComponent size={16} />} href={href}>
                <div className="flex items-center justify-center w-full text-xs text-muted-foreground animate-pulse">
                    Loading...
                </div>
            </WidgetContainer>
        );
    }

    return (
        <WidgetContainer
            title={title}
            icon={IconComponent && <IconComponent size={16} />}
            error={error}
            href={href}
        >
            {fields.map((field, idx) => (
                <WidgetBlock
                    key={idx}
                    label={field.label}
                    value={data ? formatValue(getNestedValue(data, field.path), field.format, field.suffix) : '-'}
                />
            ))}
        </WidgetContainer>
    );
}
