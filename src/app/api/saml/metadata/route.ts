import { NextResponse } from 'next/server';
import { generateSAMLMetadata } from '../../../../lib/saml/metadata';

/**
 * SAML IdP Metadata Endpoint
 * GET /api/saml/metadata
 * 
 * Returns SAML 2.0 EntityDescriptor XML for this Identity Provider
 */
export async function GET() {
    try {
        const metadata = generateSAMLMetadata();

        return new NextResponse(metadata, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
        });
    } catch (error) {
        console.error('SAML Metadata error:', error);
        return NextResponse.json(
            { error: 'Failed to generate SAML metadata' },
            { status: 500 }
        );
    }
}
