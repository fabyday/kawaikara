const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const main = path.resolve(__dirname, '../../src/Main');
const platformRoot = path.join(main, 'Platform');
const systems = ['Darwin', 'Linux', 'Windows'];
function sourceFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory()
            ? sourceFiles(filename)
            : /\.tsx?$/.test(filename)
              ? [filename]
              : [];
    });
}

test('Platform keeps native implementations behind its three OS directories', () => {
    assert.deepEqual(
        readdirSync(platformRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(),
        systems,
    );
    for (const filename of sourceFiles(main)) {
        const relative = path.relative(platformRoot, filename);
        const inside = !relative.startsWith('..');
        const system = systems.find((name) =>
            relative.startsWith(name + path.sep),
        );
        const source = ts.createSourceFile(
            filename,
            readFileSync(filename, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
        );
        for (const statement of source.statements) {
            if (
                (!ts.isImportDeclaration(statement) &&
                    !ts.isExportDeclaration(statement)) ||
                !statement.moduleSpecifier
            )
                continue;
            const specifier = statement.moduleSpecifier.text;
            if (!specifier.startsWith('.')) continue;
            const target = path.resolve(path.dirname(filename), specifier);
            const targetRelative = path.relative(platformRoot, target);
            const targetSystem = systems.find(
                (name) =>
                    targetRelative === name ||
                    targetRelative.startsWith(name + path.sep),
            );
            if (!inside)
                assert.equal(
                    targetSystem,
                    undefined,
                    `${filename} bypasses the common Platform API`,
                );
            if (system && targetSystem)
                assert.equal(
                    system,
                    targetSystem,
                    `${filename} imports another OS implementation`,
                );
            if (inside)
                assert.ok(
                    !/^\.\.\/(Manager|Functional|DependencyInjection)(\/|$)/.test(
                        targetRelative.split(path.sep).join('/'),
                    ),
                    `${filename} depends on application orchestration`,
                );
        }
    }
});
