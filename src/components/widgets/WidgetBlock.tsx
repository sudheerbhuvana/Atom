'use client';

import React from 'react';

interface WidgetBlockProps {
    label: string;
    value?: string | number | React.ReactNode;
    className?: string; // Allow custom styling if needed
}

export default function WidgetBlock({ label, value, className = '' }: WidgetBlockProps) {
    return (
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-2 rounded bg-secondary/10 dark:bg-secondary/20 min-w-[60px] ${className}`}>
            <div className="font-light text-sm mb-1 line-clamp-1">
                {value === undefined || value === null ? '-' : value}
            </div>
            <div className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider">
                {label}
            </div>
        </div>
    );
}
