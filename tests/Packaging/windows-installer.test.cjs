const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    existsSync,
} = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const {
    writeInstallerLocales,
} = require('../../packaging/installer-locales.cjs');
const {
    writeInstallerBranding,
} = require('../../packaging/installer-branding.cjs');
const projectRoot = path.resolve(__dirname, '../..');
const fixtureRoot = mkdtempSync(
    path.join(getTestTempRoot(), 'kawaikara-installer-test-'),
);
process.env.TEMP = process.env.TMP = process.env.TMPDIR = fixtureRoot;
console.log('Installer test artifacts:', fixtureRoot);

test('assisted installation uses shared options without changing update-test isolation', () => {
    const config = require('../../electron-builder.config.cjs');
    const development = require('../../electron-builder.dev.config.cjs');
    for (const options of [config.nsis, development.nsis]) {
        assert.equal(options.oneClick, false);
        assert.equal(options.allowToChangeInstallationDirectory, true);
        assert.equal(options.deleteAppDataOnUninstall, false);
        assert.equal(options.createDesktopShortcut, true);
        assert.equal(options.include, 'packaging/nsis/installer-options.nsh');
    }
    const script = readFileSync(
        path.join(projectRoot, config.nsis.include),
        'utf8',
    );
    assert.match(script, /\$\{If\} \$\{isUpdated\}\s+Abort/);
    assert.match(script, /\$\{If\} \$\{isUpdated\}\s+SetSilent silent/);
    assert.match(script, /SetCtlColors \$kawaiWarning CC2222/);
    assert.match(script, /!if "\$\{APP_ID\}" == "day.faby.kawaikara.nightly"/);
    assert.doesNotMatch(script, /EM_SETREADONLY/);
    assert.match(script, /kernel32::GetFullPathNameW/);
    assert.match(script, /EnableWindow \$kawaiPathField 1/);
    const pages = readFileSync(
        path.join(projectRoot, 'packaging/nsis/installer-pages.nsh'),
        'utf8',
    );
    assert.match(pages, /!insertmacro MUI_PAGE_WELCOME/);
    assert.match(pages, /MUI_WELCOMEFINISHPAGE_BITMAP/);
    assert.match(pages, /Page custom kawaiFinishPage kawaiFinishLeave/);
    assert.match(
        pages,
        /NSD_GetState\} \$kawaiLaunchCheckbox \$kawaiLaunchRequested/,
    );
    const branding = readFileSync(
        path.join(projectRoot, 'packaging/nsis/installer-branding.nsh'),
        'utf8',
    );
    assert.doesNotMatch(branding, /SetWindowPos|CreateWindowExW/);
    assert.match(
        branding,
        /\$kawaiLaunchRequested == 1\s+ShowWindow \$HWNDPARENT \$\{SW_HIDE\}\s+Call kawaiLaunchFinishedApp/,
    );
});

test('installer copy is generated from JSON, with NSIS interpolation escaped', () => {
    writeInstallerLocales(projectRoot, fixtureRoot);
    const generated = readFileSync(
        path.join(fixtureRoot, 'generated/installer-locales.nsh'),
        'utf8',
    );
    for (const [locale, language] of [
        ['en', 1033],
        ['ko', 1042],
        ['ja', 1041],
    ]) {
        const copy = JSON.parse(
            readFileSync(
                path.join(projectRoot, `locales/${locale}.json`),
                'utf8',
            ),
        ).installer;
        assert.ok(
            generated.includes(
                `LangString kawai_warning ${language} "${copy.warning}"`,
            ),
        );
    }
    const escapedRoot = path.join(fixtureRoot, 'escaping');
    mkdirSync(path.join(escapedRoot, 'locales'), { recursive: true });
    for (const locale of ['en', 'ko', 'ja']) {
        writeFileSync(
            path.join(escapedRoot, 'locales', `${locale}.json`),
            JSON.stringify({ installer: { example: '"${USER}"\nnext' } }),
        );
    }
    writeInstallerLocales(escapedRoot, escapedRoot);
    const escaped = readFileSync(
        path.join(escapedRoot, 'generated/installer-locales.nsh'),
        'utf8',
    );
    assert.ok(escaped.includes('$\\"$${USER}$\\"$\\r$\\nnext'));
});

test('packaging hook creates the installer catalog without changing signing hooks', async () => {
    const resources = path.join(fixtureRoot, 'hook-resources');
    await require('../../packaging/before-pack.cjs').default({
        electronPlatformName: 'win32',
        packager: {
            projectDir: projectRoot,
            config: { directories: { buildResources: resources } },
        },
    });
    assert.ok(
        existsSync(path.join(resources, 'generated/installer-locales.nsh')),
    );
    const bitmap = readFileSync(
        path.join(resources, 'generated/installer-banner.bmp'),
    );
    assert.equal(bitmap.toString('ascii', 0, 2), 'BM');
    assert.equal(bitmap.readInt32LE(18), 164);
    assert.equal(bitmap.readInt32LE(22), 314);
    assert.equal(bitmap.readUInt16LE(28), 24);
    // Both ends of the portrait must contain artwork, not the old solid padding.
    const stride = (164 * 3 + 3) & ~3;
    for (const row of [0, 313]) {
        const colors = new Set();
        for (let x = 0; x < 164; x++) {
            const offset = 54 + row * stride + x * 3;
            colors.add(bitmap.subarray(offset, offset + 3).toString('hex'));
        }
        assert.ok(
            colors.size > 1,
            'Sidebar artwork should fill the top and bottom edges',
        );
    }
});

test('native NSIS options compile against the installed toolchain (compile only; never install)', (t) => {
    const nsis =
        process.env.NSIS_HOME ||
        path.join(
            process.env.LOCALAPPDATA || '',
            'electron-builder/Cache/nsis/nsis-3.0.4.1',
        );
    const compiler = path.join(nsis, 'Bin/makensis.exe');
    if (process.platform !== 'win32' || !existsSync(compiler))
        return t.skip('Windows NSIS compiler is not cached on this host');
    writeInstallerLocales(projectRoot, fixtureRoot);
    writeInstallerBranding(projectRoot, fixtureRoot);
    // Compile the real custom pages/macros in an inert harness. This executable is never run.
    const source = `Unicode true
Name "Kawaikara Installer Compile Test"
OutFile "${path.join(fixtureRoot, 'compile-only.exe')}"
RequestExecutionLevel user
!define MUI_ICON "${path.join(projectRoot, 'resources/icons/kawaikara.ico')}"
!include MUI2.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!addplugindir "${path.join(nsis, '../nsis-resources-3.4.1/plugins/x86-unicode')}"
!define BUILD_RESOURCES_DIR "${fixtureRoot}"
!define PRODUCT_NAME "Kawaikara Nightly"
!define PRODUCT_FILENAME "Kawaikara Nightly"
!define SHORTCUT_NAME "Kawaikara Nightly"
!define APP_ID "day.faby.kawaikara.nightly"
!define isUpdated '0 = 1'
!define KAWAI_INSTALLER_PREVIEW 1
Var installMode
Var newDesktopLink
!include "${path.join(projectRoot, 'packaging/nsis/installer-options.nsh')}"
!insertmacro customWelcomePage
!insertmacro customPageAfterChangeDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro customFinishPage
!insertmacro MUI_LANGUAGE English
!insertmacro MUI_LANGUAGE Korean
!insertmacro MUI_LANGUAGE Japanese
Function .onInit
!insertmacro customInit
FunctionEnd
Section
!insertmacro customInstall
SectionEnd
`;
    const file = path.join(fixtureRoot, 'compile-only.nsi');
    writeFileSync(file, source);
    const result = spawnSync(compiler, ['/V2', file], {
        encoding: 'utf8',
        timeout: 30000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    if (process.env.KAWAI_INSTALLER_PREVIEW === '1') {
        // Separate inert wizard: no customInstall, locator writes, shortcuts, app files or registry changes.
        const preview = path.join(fixtureRoot, 'preview.exe');
        const previewSource = source
            .replace(
                'Kawaikara Installer Compile Test',
                'Kawaikara Installer Preview',
            )
            .replace(
                'RequestExecutionLevel user',
                'RequestExecutionLevel user\nInstallDir "' +
                    path.join(fixtureRoot, 'preview-install') +
                    '"\n!define KAWAI_BRAND_DIAGNOSTICS "' +
                    path.join(fixtureRoot, 'branding.txt') +
                    '"',
            )
            .replace(path.join(fixtureRoot, 'compile-only.exe'), preview)
            .replace(
                'day.faby.kawaikara.nightly',
                'day.faby.kawaikara.installer-preview',
            )
            .replace(
                '!insertmacro customPageAfterChangeDir',
                '!insertmacro MUI_PAGE_DIRECTORY\n!insertmacro customPageAfterChangeDir',
            )
            .replace(
                '!insertmacro customInstall',
                'DetailPrint "Preview only: no installation performed."',
            );
        const previewFile = path.join(fixtureRoot, 'preview.nsi');
        writeFileSync(previewFile, previewSource);
        const previewResult = spawnSync(compiler, ['/V2', previewFile], {
            encoding: 'utf8',
            timeout: 30000,
        });
        assert.equal(
            previewResult.status,
            0,
            `${previewResult.stdout}\n${previewResult.stderr}`,
        );
        console.log('Non-installing UI preview:', preview);
    }
});

test('optional electron-builder integration packages a dummy app without installing it', async (t) => {
    if (process.env.KAWAI_INSTALLER_PACKAGE_SMOKE !== '1')
        return t.skip(
            'Opt in to native packaging with KAWAI_INSTALLER_PACKAGE_SMOKE=1',
        );
    const { build, Platform, Arch } = require('electron-builder');
    const base = require('../../electron-builder.config.cjs');
    const appDirectory = path.join(fixtureRoot, 'dummy-app');
    mkdirSync(path.join(appDirectory, 'resources/app'), { recursive: true });
    writeFileSync(
        path.join(appDirectory, 'Kawaikara Installer Fixture.exe'),
        'Compile-only placeholder. Never execute or install.',
    );
    writeFileSync(
        path.join(appDirectory, 'resources/app/package.json'),
        JSON.stringify({
            name: 'kawaikara-installer-fixture',
            version: '1.0.0',
            main: 'index.js',
        }),
    );
    writeInstallerLocales(projectRoot, fixtureRoot);
    writeInstallerBranding(projectRoot, fixtureRoot);
    const artifacts = await build({
        projectDir: projectRoot,
        prepackaged: appDirectory,
        publish: 'never',
        targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
        config: {
            extends: null,
            appId: 'day.faby.kawaikara.installer-fixture',
            productName: 'Kawaikara Installer Fixture',
            electronVersion: require('electron/package.json').version,
            extraMetadata: {
                name: 'kawaikara-installer-fixture',
                version: '1.0.0',
            },
            directories: {
                output: path.join(fixtureRoot, 'packaged'),
                buildResources: fixtureRoot,
            },
            compression: 'store',
            publish: null,
            forceCodeSigning: false,
            cscLink: null,
            win: {
                signAndEditExecutable: false,
                icon: path.join(projectRoot, 'resources/icons/kawaikara.ico'),
            },
            nsis: {
                ...base.nsis,
                guid: '4a9cb659-e054-4aee-85e8-7883b1221e79',
                include: path.join(projectRoot, base.nsis.include),
                shortcutName: 'Kawaikara Installer Fixture',
                uninstallDisplayName: 'Kawaikara Installer Fixture',
            },
        },
    });
    assert.ok(artifacts.some((file) => file.endsWith('.exe')));
    console.log('Compile-only installer artifacts:', artifacts);
});
