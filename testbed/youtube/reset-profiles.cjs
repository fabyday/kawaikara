const fs = require('node:fs');
const path = require('node:path');

const profileRoot = path.join(__dirname, '.profiles');
fs.rmSync(profileRoot, { recursive: true, force: true });
console.log(`Removed testbed profiles: ${profileRoot}`);
