const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { projectRoot, getTestTempRoot } = require('./Helpers/Paths.cjs');

const suites = {
    unit: ['Unit'],
    integration: ['Integration'],
    packaging: ['Packaging'],
    native: ['Native'],
    node: ['Unit', 'Integration', 'Packaging', 'Native'],
    electron: ['Electron'],
    performance: ['Performance'],
    smoke: ['Smoke'],
};
const usage = () =>
    console.log(
        [
            'Usage: pnpm test [node|unit|integration|packaging|native|electron|performance|smoke] [file.cjs ...] [--list]',
            '',
            'pnpm test                         Run all Node suites (default).',
            'pnpm test unit                    Run isolated unit tests.',
            'pnpm test electron log-viewer.electron.cjs   Run one Electron probe.',
            'pnpm test electron --list         List jobs without building or launching.',
            '',
            'Node/integration/Electron/performance/smoke suites build workspace packages first.',
            'Smoke probes are opt-in; see the architecture test documentation for prerequisites.',
        ].join('\n'),
    );
const input = process.argv.slice(2);
if (input.includes('--help') || input.includes('-h')) {
    usage();
    process.exit(0);
}
const [suite = 'node', ...args] =
    input[0] === '--list' ? ['node', ...input] : input;
if (!Object.hasOwn(suites, suite ?? '')) {
    console.error(
        `Usage: node tests/run.cjs <${Object.keys(suites).join('|')}> [file.cjs ...] [--list]`,
    );
    process.exit(2);
}
const listOnly = args.includes('--list');
const selectors = args.filter((arg) => arg !== '--list');
const useElectron = ['electron', 'performance', 'smoke'].includes(suite);
const suffix = useElectron ? '.electron.cjs' : '.test.cjs';
let files = suites[suite]
    .flatMap((directory) =>
        readdirSync(path.join(__dirname, directory))
            .filter((file) => file.endsWith(suffix))
            .map((file) => `tests/${directory}/${file}`),
    )
    .sort();
for (const selector of selectors) {
    if (
        !files.some(
            (file) => file === selector || path.basename(file) === selector,
        )
    ) {
        console.error(`No ${suite} test matches: ${selector}`);
        process.exit(2);
    }
}
if (selectors.length)
    files = files.filter((file) =>
        selectors.some(
            (selector) => file === selector || path.basename(file) === selector,
        ),
    );
if (!files.length) {
    console.error(`The ${suite} suite contains no matching tests.`);
    process.exit(2);
}
const jobs = useElectron
    ? files.flatMap((file) =>
          file.endsWith('/graphics-mode.electron.cjs')
              ? ['native', 'capture', 'software'].map((mode) => [file, mode])
              : [[file]],
      )
    : [['--experimental-strip-types', '--test', ...files]];
if (listOnly) {
    for (const job of jobs)
        console.log(`${useElectron ? 'electron' : 'node'} ${job.join(' ')}`);
    process.exit(0);
}
const temporaryRoot = getTestTempRoot();
const env = {
    ...process.env,
    TEMP: temporaryRoot,
    TMP: temporaryRoot,
    TMPDIR: temporaryRoot,
};
if (
    ['node', 'integration', 'electron', 'performance', 'smoke'].includes(suite)
) {
    // All arguments are fixed here; filenames supplied by the user never enter a shell.
    const cli = process.env.npm_execpath;
    const pnpmCli = cli && /pnpm\.(?:c?js|mjs)$/.test(cli);
    const build = pnpmCli
        ? spawnSync(process.execPath, [cli, 'build:packages'], {
              cwd: projectRoot,
              env,
              stdio: 'inherit',
          })
        : spawnSync(
              process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
              ['build:packages'],
              {
                  cwd: projectRoot,
                  env,
                  stdio: 'inherit',
                  shell: process.platform === 'win32',
              },
          );
    if (build.error) console.error(build.error.message);
    if (build.status !== 0) process.exit(build.status ?? 1);
}
const executable = useElectron ? require('electron') : process.execPath;
for (const job of jobs) {
    console.log(`Running ${suite}: ${job.join(' ')}`);
    const result = spawnSync(executable, job, {
        cwd: projectRoot,
        env,
        stdio: 'inherit',
        timeout: useElectron ? 300000 : 180000,
    });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0) process.exit(result.status ?? 1);
}
