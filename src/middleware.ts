import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/onboard', '/api/auth', '/api/config'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get('atom_session');

    if (!sessionCookie) {
        // Redirect to login (or onboard, frontend will handle)
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/stats).*)',
    ],
};
