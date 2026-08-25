const {
  cpSync,
  mkdtempSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const arguments_ = process.argv.slice(2);
if (arguments_[0] === '--') arguments_.shift();
const outputPath = path.resolve(
  root,
  arguments_[0] || 'kawaikara.builtin-sites.kawai',
);

const sourcePath = path.join(root, 'packages', 'builtin-sites', 'dist');
const stagingPath = mkdtempSync(path.join(tmpdir(), 'kawaikara-builtin-bundle-'));

try {
  cpSync(sourcePath, stagingPath, { recursive: true });

  const result = spawnSync('zip', ['-q', '-r', outputPath, '.'], {
    cwd: stagingPath,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`zip failed with exit code ${String(result.status)}.`);
  }
  console.log(`Created ${outputPath}`);
} finally {
  rmSync(stagingPath, { recursive: true, force: true });
}
