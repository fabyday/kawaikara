const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

function loadLocalEnvironment(root) {
  const values = {};
  for (const name of ['.env', '.env.local']) {
    const environmentPath = path.join(root, name);
    if (!existsSync(environmentPath)) continue;
    Object.assign(values, parseEnv(readFileSync(environmentPath, 'utf8')));
  }

  // Explicit shell/CI variables remain authoritative over local files.
  for (const [name, value] of Object.entries(values)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

module.exports = { loadLocalEnvironment };
