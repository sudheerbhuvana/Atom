'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface WidgetContainerProps {
    title?: string;
    icon?: React.ReactNode;
    error?: string | null;
    children?: React.ReactNode;
    href?: string;
    className?: string;
}

export default function WidgetContainer({
    title,
    icon,
    error,
    children,
    href,
    className = ''
}: WidgetContainerProps) {
    const content = (
        <div className={`flex flex-col h-full w-full ${className}`}>
            {(title || icon) && (
                <div className="flex items-center gap-2 mb-2 text-muted-foreground px-1">
                    {icon && <span className="w-4 h-4">{icon}</span>}
                    {title && <span className="text-xs font-medium uppercase tracking-wider">{title}</span>}
                </div>
            )}

            <div className="flex-1 flex flex-row gap-2 w-full overflow-hidden">
                {error ? (
                    <div className="flex items-center justify-center w-full h-full text-destructive text-xs p-2 bg-destructive/10 rounded">
                        <AlertCircle size={14} className="mr-1" />
                        <span className="truncate">{error}</span>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );

    if (href && !error) {
        return (
            <a href={href} className="block w-full h-full hover:opacity-80 transition-opacity">
                {content}
            </a>
        );
    }

    return content;
}
