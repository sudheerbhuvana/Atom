import tcpPing from 'tcp-ping';

export type StatusResult = {
    up: boolean;
    status: number;
    latency: number;
    method: 'tcp-ping' | 'fetch';
    error?: string;
};

// Helper to determine if a hostname is likely internal
function isInternal(hostname: string): boolean {
    if (hostname === 'localhost') return true;
    const privateIpRegex = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
    if (privateIpRegex.test(hostname)) return true;
    if (!hostname.includes('.') || hostname.endsWith('.local')) return true;
    return false;
}

export async function checkServiceStatus(urlString: string): Promise<StatusResult> {
    const start = Date.now();

    try {
        const u = new URL(urlString);
        const internal = isInternal(u.hostname);

        if (internal) {
            return new Promise((resolve) => {
                const port = parseInt(u.port) || (u.protocol === 'https:' ? 443 : 80);

                tcpPing.ping({
                    address: u.hostname,
                    port: port,
                    attempts: 1,
                    timeout: 2000
                }, (err, data) => {
                    const result = data.results[0];
                    const isValid = !err && result && typeof result.time === 'number' && !Number.isNaN(result.time);
                    const finalLatency = isValid && result.time ? Math.round(result.time) : 0;

                    resolve({
                        up: isValid,
                        status: isValid ? 200 : 0,
                        latency: finalLatency,
                        method: 'tcp-ping'
                    });
                });
            });
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(urlString, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    },
                    signal: controller.signal,
                    cache: 'no-store',
                    redirect: 'follow'
                });

                // Always clear timeout to prevent memory leaks
                clearTimeout(timeoutId);
                const latency = Date.now() - start;

                // Interpret response
                // Any 2xx-5xx response means the server is UP and reachable.
                // But typically for dashboards, 200-299 is "UP".
                // Let's stick to ok (200-299) for UP status per previous feedback.
                return {
                    up: response.ok,
                    status: response.status,
                    latency: latency,
                    method: 'fetch'
                };
            } catch (fetchErr) {
                // Ensure timeout is cleared even on error
                clearTimeout(timeoutId);
                return {
                    up: false,
                    status: 0,
                    error: (fetchErr as Error).message,
                    latency: Date.now() - start, // Calculate latency even on error
                    method: 'fetch'
                };
            }
        }
    } catch (error: unknown) {
        return {
            up: false,
            status: 0,
            error: error instanceof Error ? error.message : String(error),
            latency: 0,
            method: 'fetch'
        };
    }
}
