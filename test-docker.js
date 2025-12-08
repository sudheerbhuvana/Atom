const Docker = require('dockerode');
const docker = new Docker();

async function test() {
    try {
        console.log('Attempting to connect to Docker...');
        const containers = await docker.listContainers();
        console.log('Connection successful!');
        console.log(`Found ${containers.length} containers.`);
        containers.forEach(c => console.log(`- ${c.Names[0]} (${c.State})`));
    } catch (err) {
        console.error('Failed to connect to Docker:', err.message);
        if (process.platform === 'win32') {
            console.log('Tip: Ensure Docker Desktop is running and exposing the named pipe //./pipe/docker_engine');
        }
    }
}

test();
