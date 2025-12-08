import { NextResponse } from 'next/server';
import Docker from 'dockerode';

// Initialize Docker client
// By default, this looks for /var/run/docker.sock on Linux/Mac
// or //./pipe/docker_engine on Windows.
const docker = new Docker();

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(startedAt: string) {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const diff = now - start;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} days`;
    }
    return `${hours}h`;
}

export async function GET() {
    try {
        const containers = await docker.listContainers();

        const promises = containers.map(async (containerInfo) => {
            const container = docker.getContainer(containerInfo.Id);

            // Get stats (stream: false makes it a single snapshot)
            // Note: Docker stats API can be slow if parallelized too much
            const stats = await container.stats({ stream: false });

            // Inspect to get full details like startedAt
            const inspect = await container.inspect();

            // CPU Calculation
            let cpuPercent = 0.0;
            const cpuStats = stats.cpu_stats;
            const precpuStats = stats.precpu_stats;

            if (cpuStats && precpuStats && cpuStats.cpu_usage && precpuStats.cpu_usage) {
                const cpuDelta = cpuStats.cpu_usage.total_usage - precpuStats.cpu_usage.total_usage;
                const systemDelta = cpuStats.system_cpu_usage - precpuStats.system_cpu_usage;

                if (systemDelta > 0 && cpuDelta > 0) {
                    // Use online_cpus if available, otherwise percpu_usage length, fallback to 1
                    const onlineCpus = cpuStats.online_cpus || (cpuStats.cpu_usage.percpu_usage ? cpuStats.cpu_usage.percpu_usage.length : 1);
                    cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
                }
            }

            // Memory Calculation
            let memUsage = 0;
            let memLimit = 0;

            if (stats.memory_stats) {
                // v1 usually has 'usage', v2 might differ but dockerode usually normalizes or provides raw
                // stats.memory_stats.usage checks
                memUsage = stats.memory_stats.usage || 0;
                memLimit = stats.memory_stats.limit || 0;
            }

            const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

            // Ports formatting
            const ports = containerInfo.Ports
                .filter(p => p.PublicPort)
                .map(p => `${p.PublicPort}->${p.PrivatePort}`)
                .join(', ');

            return {
                id: containerInfo.Id.substring(0, 12),
                name: containerInfo.Names[0].replace(/^\//, ''), // Remove leading slash
                image: containerInfo.Image,
                state: containerInfo.State, // running, exited
                status: `Up ${formatUptime(inspect.State.StartedAt)}`,
                cpu: parseFloat(cpuPercent.toFixed(2)),
                memory: formatBytes(memUsage),
                memPercent: parseFloat(memPercent.toFixed(2)),
                ports: ports
            };
        });

        const results = await Promise.all(promises);

        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Docker API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch docker stats', details: error.message },
            { status: 500 }
        );
    }
}
