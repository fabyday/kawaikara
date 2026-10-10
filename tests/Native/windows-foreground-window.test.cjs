const { createTestTempDirectory } = require('../Helpers/Paths.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
test(
    'native WinEvent/monitor regression fixtures (no real windows or focus changes)',
    {
        skip: process.platform !== 'win32',
    },
    () => {
        const vswhere = path.join(
            process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)',
            'Microsoft Visual Studio/Installer/vswhere.exe',
        );
        assert.ok(
            existsSync(vswhere),
            'Visual Studio C++ build tools are required',
        );
        const installation = spawnSync(
            vswhere,
            [
                '-latest',
                '-products',
                '*',
                '-requires',
                'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                '-property',
                'installationPath',
            ],
            { encoding: 'utf8' },
        );
        assert.equal(installation.status, 0, installation.stderr);
        const vcvars = path.join(
            installation.stdout.trim(),
            'VC/Auxiliary/Build/vcvars64.bat',
        );
        assert.ok(existsSync(vcvars));
        const output = createTestTempDirectory('native-fullscreen-');
        mkdirSync(output, { recursive: true });
        const executable = path.join(output, 'fullscreen-test.exe');
        const command =
            `call "${vcvars}" >nul && cl.exe /nologo /std:c++17 /EHsc /O2 /DUNICODE /D_UNICODE ` +
            `/Fo:"${path.join(output, 'fullscreen-test.obj')}" ` +
            `"${path.join(root, 'tests/Native/windows-foreground-window.test.cpp')}" ` +
            `/link /OUT:"${executable}" /IMPLIB:"${path.join(output, 'fullscreen-test.lib')}" user32.lib`;
        const build = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
            cwd: root,
            encoding: 'utf8',
            windowsVerbatimArguments: true,
        });
        assert.equal(build.status, 0, build.stdout + build.stderr);
        const result = spawnSync(executable, [], {
            cwd: output,
            encoding: 'utf8',
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /All native fullscreen fixtures passed/);
    },
);
