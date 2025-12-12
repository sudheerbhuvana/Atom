import { NextResponse } from 'next/server';
import Docker from 'dockerode';

export const dynamic = 'force-dynamic';

const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const calculateCPUPercent = (stats: unknown) => {
    const s = stats as { cpu_stats?: { cpu_usage?: { total_usage?: number; percpu_usage?: number[] }; system_cpu_usage?: number; online_cpus?: number }; precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number } };
    let cpuPercent = 0.0;
    // Check if stats are available
    if (!s.cpu_stats || !s.precpu_stats) return 0;

    // Calculate deltas
    const cpuDelta = (s.cpu_stats.cpu_usage?.total_usage || 0) - (s.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = (s.cpu_stats.system_cpu_usage || 0) - (s.precpu_stats.system_cpu_usage || 0);
    const onlineCpus = s.cpu_stats.online_cpus || s.cpu_stats.cpu_usage?.percpu_usage?.length || 1;

    if (systemDelta > 0.0 && cpuDelta > 0.0) {
        cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
    }
    return Math.round(cpuPercent * 10) / 10;
};

const calculateMemPercent = (stats: unknown) => {
    const s = stats as { memory_stats?: { limit?: number; usage?: number; stats?: { inactive_file?: number } } };
    if (!s.memory_stats || !s.memory_stats.limit) return 0;

    // Some docker versions use 'usage', others might differ, but standard is:
    // usage - inactive_file
    const used = (s.memory_stats.usage || 0) - (s.memory_stats.stats?.inactive_file || 0);
    const limit = s.memory_stats.limit || 0;

    if (limit === 0) return 0;
    return Math.round((used / limit) * 100);
};

export async function GET() {
    try {
        // Connect to Docker socket
        const docker = new Docker({ timeout: 5000 });

        const listPromise = docker.listContainers({ all: true });

        // Use a longer global timeout for listing
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Docker list timed out')), 5000)
        );

        const containers = await Promise.race([listPromise, timeoutPromise]) as Docker.ContainerInfo[];

        // Parallel fetch stats for running containers with individual timeouts
        const containersWithStats = await Promise.all(containers.map(async (container) => {
            const portsList = new Set(
                container.Ports?.filter((p: { PublicPort?: number }) => p.PublicPort)
                    .map((p: { PublicPort?: number; PrivatePort: number }) => `${p.PublicPort}:${p.PrivatePort}`)
            );

            const simpleContainer: { id: string; name: string; image: string; state: string; status: string; ports: string; cpu?: number; memPercent?: number; memory?: string } = {
                id: container.Id.substring(0, 12),
                name: container.Names[0].replace('/', ''),
                image: container.Image.length > 40 ? container.Image.substring(0, 20) + '...' : container.Image,
                state: container.State,
                status: container.Status,
                ports: Array.from(portsList).join(', ')
            };

            if (container.State === 'running') {
                try {
                    // Race stats fetch against a 2s timeout
                    // This ensures one slow container doesn't break the whole dashboard
                    const statsPromise = docker.getContainer(container.Id).stats({ stream: false });
                    const statsTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Stats timeout')), 2000));

                    const stats = await Promise.race([statsPromise, statsTimeout]) as Docker.ContainerStats;

                    simpleContainer.cpu = calculateCPUPercent(stats);

                    const used = (stats.memory_stats?.usage || 0) - (stats.memory_stats?.stats?.inactive_file || 0);
                    const limit = stats.memory_stats?.limit || 0;
                    simpleContainer.memPercent = calculateMemPercent(stats);
                    simpleContainer.memory = `${formatBytes(used)} / ${formatBytes(limit)}`;

                } catch {
                    // Fail silently for stats, just show 0
                    // console.error(`Stats failed for ${simpleContainer.name}`, e);
                    simpleContainer.cpu = 0;
                    simpleContainer.memPercent = 0;
                    simpleContainer.memory = '-';
                }
            } else {
                simpleContainer.cpu = 0;
                simpleContainer.memPercent = 0;
                simpleContainer.memory = '-';
            }

            return simpleContainer;
        }));

        return NextResponse.json({ containers: containersWithStats });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Docker API Error:', error);
        const isWindows = process.platform === 'win32';
        const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';

        return NextResponse.json({
            error: 'Failed to connect to Docker',
            details: errorMsg,
            hint: `Tried default socket: ${socketPath}. Ensure Docker is running.`
        }, { status: 500 });
    }
}
