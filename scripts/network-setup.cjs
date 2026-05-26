const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Luna Eye Hospital - Network Domain Setup Script
 * This script configures the local machine for LAN-wide domain access.
 */

const DOMAIN = 'lunaeyehospital';
const HOSTS_PATH = process.platform === 'win32' 
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' 
    : '/etc/hosts';

function getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function updateHostsFile() {
    console.log(`Updating hosts file to map ${DOMAIN} to 127.0.0.1...`);
    try {
        const entry = `127.0.0.1 ${DOMAIN}`;
        let hostsContent = '';
        if (fs.existsSync(HOSTS_PATH)) {
            hostsContent = fs.readFileSync(HOSTS_PATH, 'utf8');
        }
        
        if (hostsContent.includes(DOMAIN)) {
            console.log(`Entry for ${DOMAIN} already exists in hosts file.`);
        } else {
            // Ensure there's a newline before appending
            const prefix = hostsContent.endsWith('\n') ? '' : '\n';
            fs.appendFileSync(HOSTS_PATH, `${prefix}${entry}\n`);
            console.log(`Successfully added ${DOMAIN} to hosts file.`);
        }
    } catch (err) {
        console.error('ERROR: Could not update hosts file. Please run this script as Administrator.');
        console.error(err.message);
    }
}

function configureFirewall() {
    if (process.platform !== 'win32') return;
    console.log('Configuring Windows Firewall rules...');
    try {
        const rules = [
            { name: 'Luna EMR HTTP', port: 3200, proto: 'TCP' },
            { name: 'Luna EMR DNS', port: 53, proto: 'UDP' },
            { name: 'Luna EMR NBNS', port: 137, proto: 'UDP' }
        ];

        for (const rule of rules) {
            try {
                // Delete existing rule first to avoid duplicates
                execSync(`netsh advfirewall firewall delete rule name="${rule.name}"`, { stdio: 'ignore' });
                // Add new rule
                execSync(`netsh advfirewall firewall add rule name="${rule.name}" dir=in action=allow protocol=${rule.proto} localport=${rule.port}`);
                console.log(`Firewall rule created: ${rule.name} (${rule.proto} ${rule.port})`);
            } catch (e) {
                console.warn(`Could not set firewall rule ${rule.name}: ${e.message}`);
            }
        }
    } catch (err) {
        console.warn('Firewall configuration skipped or failed.');
    }
}

function configureAppServer() {
    const lanIp = getLanIp();
    console.log(`Detected LAN IP: ${lanIp}`);
    
    // Update server's .env if it exists
    const envPath = path.join(__dirname, '..', 'server', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const settings = {
        'PORT': '3200',
        'LAN_IP': lanIp,
        'DOMAIN_NAME': DOMAIN
    };
    
    for (const [key, value] of Object.entries(settings)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('Server environment variables updated.');
}

function setupWindowsStartup() {
    if (process.platform !== 'win32') return;
    
    console.log('Setting up persistent startup for the EMR server...');
    try {
        // Create a batch file to start the server
        const projectRoot = path.join(__dirname, '..');
        const batPath = path.join(projectRoot, 'start-server.bat');
        const batContent = `@echo off\ncd /d "${path.join(projectRoot, 'server')}"\nnpm start\n`;
        fs.writeFileSync(batPath, batContent);
        
        // Add to Windows Startup folder for the current user
        const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const shortcutPath = path.join(startupFolder, 'LunaEyeHospitalEMR.bat');
        
        fs.copyFileSync(batPath, shortcutPath);
        console.log(`Persistent startup link created in: ${shortcutPath}`);
    } catch (err) {
        console.warn('Could not configure startup shortcut automatically:', err.message);
    }
}

console.log('--- Luna Eye Hospital Network Domain Setup ---');
updateHostsFile();
configureFirewall();
configureAppServer();
setupWindowsStartup();
console.log('-----------------------------------------------');
console.log(`Setup complete! The EMR should now be reachable at http://${DOMAIN}/`);
console.log('Note: To reach it from other computers, ensure your Firewall allows port 80.');
