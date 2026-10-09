const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ entryPoints: [path.join(root, 'src/Renderer/View/LogViewer/LogDocumentUpdate.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const implementation = new Module(__filename);
implementation._compile(compiled.outputFiles[0].text, __filename);
const { mergeLogDocument } = implementation.exports;
const row = { id: '1', timestamp: '12:00:00', level: 'info', source: 'application', location: 'Application', message: 'hello' };
const doc = { file: { fileName: '2026-10-10-0.log', repository: 'application', active: true, size: 10, modifiedAt: 1 }, entries: [row], truncated: false };

test('idle polling keeps the entire document and row identities', () => {
  assert.equal(mergeLogDocument(doc, structuredClone(doc)), doc);
});
test('append and multiline completion only replace changed rows', () => {
  const appended = mergeLogDocument(doc, { ...doc, entries: [structuredClone(row), { ...row, id: '2', message: 'next' }] });
  assert.equal(appended.entries[0], row);
  assert.equal(appended.entries.length, 2);
  const completed = mergeLogDocument(appended, { ...appended, entries: [row, { ...appended.entries[1], message: 'next\ncontinued' }] });
  assert.notEqual(completed.entries[1], appended.entries[1]);
  assert.equal(completed.entries[0], row);
});
test('metadata updates and repository changes are not hidden by row reuse', () => {
  const modified = { ...doc, file: { ...doc.file, size: 15 } };
  assert.equal(mergeLogDocument(doc, modified).file.size, 15);
  assert.equal(mergeLogDocument(doc, modified).entries, doc.entries);
  const external = { ...doc, file: { ...doc.file, repository: 'external', groupId: 'imported' }, entries: [structuredClone(row)] };
  assert.equal(mergeLogDocument(doc, external), external);
});

// Load only the orchestrator itself: no player, user profile, or native windows.
const windowsModule = new Module(__filename);
windowsModule.require = id => id.startsWith('node:') ? require(id)
  : id === '../../Common/IPC' ? { IPC_CHANNELS: { overlay: { hidden: 'hidden' } } } : {};
windowsModule._compile(buildSync({ entryPoints: [path.join(root, 'src/Main/Manager/WindowManager.ts')],
  bundle: false, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
const { WindowManager } = windowsModule.exports;
const windowState = () => {
  const calls = [];
  const content = name => ({ isDestroyed: () => false, focus: () => calls.push(name) });
  const windows = Object.assign(Object.create(WindowManager.prototype), {
    overlayVisible: true,
    overlaySurface: { webContents: { ...content('overlay'), send: () => {} }, setVisible: value => calls.push(['visible', value]) },
    siteView: { webContents: content('site') },
    videoView: { webContents: content('video'), getVisible: () => true },
    viewerWindow: { focus: () => {} },
    logViewer: { focusEmbedded: () => true, isEmbedded: () => true,
      close: () => assert.fail('Closing the menu must not close the independent log viewer') },
    clearOverlayRevealTimer: () => {}, syncOverlayBounds: () => {},
  });
  return { windows, calls };
};

test('closing menu/preferences does not close or defocus an embedded log viewer', () => {
  const { windows, calls } = windowState();
  windows.hideOverlay();
  assert.equal(windows.overlayVisible, false);
  assert.deepEqual(calls, [['visible', false]]);
});

test('log close focuses only the underlying visible layer without reopening anything', () => {
  const { windows, calls } = windowState();
  windows.focusUnderlyingLogViewer();
  windows.overlayVisible = false;
  windows.focusUnderlyingLogViewer();
  windows.internalVideoVisible = true;
  windows.focusUnderlyingLogViewer();
  assert.deepEqual(calls, ['overlay', 'site', 'video']);
  assert.equal(windows.overlayVisible, false);
});

test('delayed Video focus cannot take input from the returned log viewer', () => {
  const { windows, calls } = windowState();
  windows.overlayVisible = false;
  windows.internalVideoVisible = true;
  windows.focusInternalVideoView();
  assert.deepEqual(calls, []);
});
