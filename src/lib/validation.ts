import { z } from 'zod';

// Username validation schema
export const usernameSchema = z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Password validation schema
export const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters');

// Service validation schema
export const serviceSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Service name is required'),
    url: z.string().url('Invalid URL'),
    icon: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    ping: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
});

// Link validation schema
export const linkSchema = z.object({
    id: z.string(),
    title: z.string().min(1, 'Link title is required'),
    url: z.string().url('Invalid URL'),
    icon: z.string().optional(),
});

// Theme config validation schema
export const themeConfigSchema = z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
    backgroundImage: z.string().url().optional().or(z.literal('')),
    mode: z.enum(['light', 'dark']).optional(),
});

// App config validation schema
export const appConfigSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    theme: themeConfigSchema,
    services: z.array(serviceSchema),
    links: z.array(linkSchema),
    layout: z.object({
        columns: z.number().int().min(1).max(12),
        gap: z.number().int().min(0).max(50),
        showWidgets: z.boolean().optional(),
        fullSizeButtons: z.boolean().optional(),
        style: z.enum(['list', 'grid']).optional(),
        containerWidth: z.enum(['full', 'centered', 'compact']).optional(),
    }),
    searchEngine: z.string().optional(),
    user: z.object({
        name: z.string(),
    }).optional(),
    weather: z.object({
        location: z.string(),
        lat: z.number().optional(),
        long: z.number().optional(),
    }).optional(),
    widgets: z.array(z.object({
        id: z.string(),
        type: z.enum(['system-monitor', 'weather', 'clock', 'generic', 'docker']),
        title: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
    })).optional(),
});

// Login/Register request schemas
export const loginSchema = z.object({
    username: usernameSchema,
    password: passwordSchema,
});

export const registerSchema = z.object({
    username: usernameSchema,
    password: passwordSchema,
});

export const changePasswordSchema = z.object({
    id: z.number().int().positive(),
    password: passwordSchema,
});

export const createUserSchema = z.object({
    username: usernameSchema,
    password: passwordSchema,
});

