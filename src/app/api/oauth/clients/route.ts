import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth';
import {
    createOAuthClient,
    listOAuthClients,
    deleteOAuthClient,
    updateOAuthClient,
    getOAuthClientByClientId
} from '@/lib/db-oauth';
import { SUPPORTED_SCOPES } from '@/lib/oauth/types';
import { getConfig, saveConfig } from '@/lib/config';
import { AppConfig, Service } from '@/types';

/**
 * OAuth2 Client Management API
 * GET /api/oauth/clients - List all OAuth clients
 * POST /api/oauth/clients - Create a new OAuth client
 * PATCH /api/oauth/clients/:id - Update an OAuth client
 * DELETE /api/oauth/clients/:id - Delete an OAuth client
 * 
 * Requires dashboard authentication.
 */

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');

    // Allow fetching a specific client by client_id without authentication
    // This is needed for the consent screen to display client information
    if (clientId) {
        try {
            const client = getOAuthClientByClientId(clientId);
            if (!client) {
                return NextResponse.json({ error: 'not_found' }, { status: 404 });
            }

            // Return only public information (no secret)
            return NextResponse.json({
                client: {
                    id: client.id,
                    client_id: client.client_id,
                    name: client.name,
                    description: client.description,
                    redirect_uris: client.redirect_uris,
                    allowed_scopes: client.allowed_scopes,
                },
            });
        } catch (error) {
            console.error('Error fetching OAuth client:', error);
            return NextResponse.json({ error: 'server_error' }, { status: 500 });
        }
    }

    // For listing all clients, require authentication
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const clients = listOAuthClients();

        // Sync existing clients to dashboard config
        try {
            const config = await getConfig();
            let configChanged = false;
            console.log('Checking for OAuth clients to sync with dashboard...');

            if (!config.services) {
                config.services = [];
            }

            for (const client of clients) {
                const existingService = config.services.find(s => s.id === client.client_id);

                if (!existingService && client.redirect_uris && client.redirect_uris.length > 0) {
                    try {
                        const serviceUrl = new URL(client.redirect_uris[0]).origin;
                        const newService: Service = {
                            id: client.client_id,
                            name: client.name,
                            url: serviceUrl,
                            description: client.description || '',
                            icon: 'lock',
                            category: 'Applications',
                            createdAt: Date.now(), // We don't have created_at in basic client list, use now
                            updatedAt: Date.now()
                        };

                        config.services.push(newService);
                        configChanged = true;
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }
            }

            if (configChanged) {
                await saveConfig(config);
            }
        } catch (syncError) {
            console.error('Failed to sync clients to dashboard:', syncError);
            // Non-blocking error
        }

        // Don't return client secrets in list view
        const safeClients = clients.map(client => {
            const { client_secret, ...rest } = client;
            return rest;
        });

        return NextResponse.json({ clients: safeClients });
    } catch (error) {
        console.error('Error listing OAuth clients:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'Failed to list clients' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, redirect_uris, allowed_scopes, grant_types, is_confidential } = body;

        // Validate required fields
        if (!name || !redirect_uris || redirect_uris.length === 0) {
            return NextResponse.json(
                { error: 'invalid_request', message: 'Name and at least one redirect URI are required' },
                { status: 400 }
            );
        }

        // Validate redirect URIs
        for (const uri of redirect_uris) {
            try {
                new URL(uri);
            } catch {
                return NextResponse.json(
                    { error: 'invalid_request', message: `Invalid redirect URI: ${uri}` },
                    { status: 400 }
                );
            }
        }

        // Use default scopes if not provided
        const scopes = allowed_scopes && allowed_scopes.length > 0
            ? allowed_scopes
            : Array.from(SUPPORTED_SCOPES);

        // Use default grant types if not provided
        const grants = grant_types && grant_types.length > 0
            ? grant_types
            : ['authorization_code', 'refresh_token'];

        // Create client
        const client = createOAuthClient(
            name,
            description,
            redirect_uris,
            scopes,
            grants,
            is_confidential !== false // Default to confidential
        );

        // Add to dashboard config
        try {
            const config = await getConfig();
            const serviceUrl = new URL(redirect_uris[0]).origin;

            const newService: Service = {
                id: client.client_id, // Link service ID to client ID
                name: client.name,
                url: serviceUrl,
                description: client.description,
                icon: 'lock', // Default icon for OAuth apps
                category: 'Applications',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Ensure services array exists
            if (!config.services) config.services = [];

            config.services.push(newService);
            await saveConfig(config);
        } catch (configError) {
            console.error('Failed to add client to dashboard config:', configError);
            // Don't fail the request if config update fails, just log it
        }

        return NextResponse.json({ client }, { status: 201 });
    } catch (error) {
        console.error('Error creating OAuth client:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'Failed to create client' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { client_id, name, description, redirect_uris, allowed_scopes, grant_types } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'invalid_request', message: 'client_id is required' },
                { status: 400 }
            );
        }

        // Validate redirect URIs if provided
        if (redirect_uris) {
            for (const uri of redirect_uris) {
                try {
                    new URL(uri);
                } catch {
                    return NextResponse.json(
                        { error: 'invalid_request', message: `Invalid redirect URI: ${uri}` },
                        { status: 400 }
                    );
                }
            }
        }

        const updated = updateOAuthClient(client_id, {
            name,
            description,
            redirect_uris,
            allowed_scopes,
            grant_types,
        });

        if (!updated) {
            return NextResponse.json(
                { error: 'not_found', message: 'Client not found' },
                { status: 404 }
            );
        }

        // Update dashboard config if exists
        try {
            const config = await getConfig();
            const serviceIndex = config.services?.findIndex(s => s.id === client_id);

            if (serviceIndex !== undefined && serviceIndex !== -1 && config.services) {
                const service = config.services[serviceIndex];

                // Update fields if provided
                if (name) service.name = name;
                if (description) service.description = description;
                if (redirect_uris && redirect_uris.length > 0) {
                    service.url = new URL(redirect_uris[0]).origin;
                }
                service.updatedAt = Date.now();

                config.services[serviceIndex] = service;
                await saveConfig(config);
            }
        } catch (configError) {
            console.error('Failed to update dashboard config for client:', configError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating OAuth client:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'Failed to update client' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const client_id = searchParams.get('client_id');

        if (!client_id) {
            return NextResponse.json(
                { error: 'invalid_request', message: 'client_id is required' },
                { status: 400 }
            );
        }

        const deleted = deleteOAuthClient(client_id);

        if (!deleted) {
            return NextResponse.json(
                { error: 'not_found', message: 'Client not found' },
                { status: 404 }
            );
        }

        // Remove from dashboard config
        try {
            const config = await getConfig();
            if (config.services) {
                const initialLength = config.services.length;
                config.services = config.services.filter(s => s.id !== client_id);

                if (config.services.length !== initialLength) {
                    await saveConfig(config);
                }
            }
        } catch (configError) {
            console.error('Failed to remove client from dashboard config:', configError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting OAuth client:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'Failed to delete client' },
            { status: 500 }
        );
    }
}
