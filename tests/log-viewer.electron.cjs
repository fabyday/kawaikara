// Real Electron hosts and React/KawaiUI. Only fixture logs and a temporary profile are used.
const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const fixture = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-log-viewer-'));
app.setPath('userData', path.join(fixture, 'profile'));
app.disableHardwareAcceleration();
for (const directory of ['main', 'renderer', 'preload']) mkdirSync(path.join(fixture, directory));
const build = (source, target, platform) => buildSync({ entryPoints: [path.join(root, source)], outfile: path.join(fixture, target), bundle: true,
  platform, format: platform === 'browser' ? 'iife' : 'cjs', external: platform === 'node' ? ['electron'] : [], loader: { '.css': 'empty' }, jsx: 'automatic' });
build('src/Main/Manager/LogViewerWindowManager.ts', 'main/manager.cjs', 'node');
build('src/Preload/Preload.ts', 'preload/preload.js', 'node');
build('src/Renderer/View/LogViewer/Index.tsx', 'renderer/view.js', 'browser');
const css = [require.resolve('@kawaikara/kawai-ui/styles.css'), 'src/Renderer/Styles/LogViewer.css', 'src/Renderer/Styles/LogViewerWindow.css']
  .map(file => readFileSync(path.isAbsolute(file) ? file : path.join(root, file), 'utf8')).join('\n');
writeFileSync(path.join(fixture, 'renderer/style.css'), css);
writeFileSync(path.join(fixture, 'renderer/log-viewer.html'), '<!doctype html><link rel="stylesheet" href="style.css"><div id="root"></div><script src="view.js"></script>');
const labels = Object.fromEntries(['en', 'ko', 'ja'].map(locale => [locale, JSON.parse(readFileSync(path.join(root, `locales/${locale}.json`), 'utf8')).logViewer]));
const { LogViewerWindowManager } = require(path.join(fixture, 'main/manager.cjs'));
const { IPC_CHANNELS } = (() => {
  const output = buildSync({ entryPoints: [path.join(root, 'src/Common/IPC.ts')], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const file = path.join(fixture, 'main/channels.cjs'); writeFileSync(file, output); return require(file);
})();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = setTimeout(() => { console.error('Log viewer test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const parent = new BrowserWindow({ width: 1120, height: 760, show: false, webPreferences: { sandbox: true } });
  await parent.loadURL('about:blank');
  let appearance = { theme: 'dark', locale: 'en' };
  const underlying = new WebContentsView({ webPreferences: { sandbox: true } });
  parent.contentView.addChildView(underlying);
  underlying.setBounds({ x: 0, y: 0, width: 1120, height: 760 });
  await underlying.webContents.loadURL('about:blank');
  let restoredFocus = 0;
  const manager = new LogViewerWindowManager(() => parent, () => {
    restoredFocus++;
    (underlying.getVisible() ? underlying.webContents : parent.webContents).focus();
  }, () => appearance);
  parent.on('focus', () => manager.focusEmbedded());
  let readCount = 0;
  const files = Array.from({ length: 48 }, (_, i) => ({ repository: 'application', fileName: `2026-10-10-${48 - i}.log`, active: i === 0, size: 1000, modifiedAt: new Date().toISOString() }));
  const entries = Array.from({ length: 140 }, (_, i) => ({ id: String(i), timestamp: '2026-10-10 12:00:00.000', level: 'info', source: 'application', location: 'Application', message: `Line ${i}` }));
  ipcMain.handle(IPC_CHANNELS.application.messages, (_event, locale) => ({ locale, logViewer: labels[locale] }));
  ipcMain.handle(IPC_CHANNELS.application.listLogFiles, () => structuredClone(files));
  ipcMain.handle(IPC_CHANNELS.application.listLogGroups, () => []);
  ipcMain.handle(IPC_CHANNELS.application.readLogFile, (_event, _repository, name) => {
    readCount++;
    return { file: files.find(f => f.fileName === name), entries: structuredClone(entries), truncated: false };
  });
  let pendingMove;
  ipcMain.handle(IPC_CHANNELS.logViewer.command, async (event, command) => {
    assert.ok(manager.owns(event.sender.id));
    if (command === 'toggle') await (pendingMove = manager.toggle());
    if (command === 'close') manager.close();
    return manager.getState();
  });
  await manager.open();
  const view = parent.contentView.children.find(child => child.webContents?.getURL().endsWith('log-viewer.html'));
  assert.ok(view);
  const contents = view.webContents;
  const evalView = code => contents.executeJavaScript(code);
  // Exercise real Chromium pointer hit testing, not HTMLElement.click().
  const clickButton = async (label, target = contents) => {
    const point = await target.executeJavaScript(`(() => {
      const button = document.querySelector('[title="${label}"]');
      const rect = button.getBoundingClientRect();
      const x = Math.round(rect.x + rect.width / 2), y = Math.round(rect.y + rect.height / 2);
      if (!button.contains(document.elementFromPoint(x, y))) throw new Error('Button is covered');
      return { x, y };
    })()`);
    target.sendInputEvent({ type: 'mouseMove', ...point });
    target.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    target.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await pause(30);
  };
  const moveByButton = async label => {
    pendingMove = undefined;
    await clickButton(label);
    for (let i = 0; i < 20 && !pendingMove; i++) await pause(10);
    assert.ok(pendingMove, `First click must dispatch ${label}`);
    await pendingMove;
  };
  for (let i = 0; i < 100; i++) {
    if (await evalView('Boolean(document.querySelector(".log-viewer-entry"))')) break;
    await pause(40);
  }
  assert.equal(await evalView('document.querySelectorAll(".log-viewer-entry").length'), 140);
  assert.equal(await evalView('document.querySelectorAll(".log-viewer-file.is-selected").length'), 1);
  assert.equal(await evalView('document.querySelector(".log-viewer-file.is-selected").getAttribute("aria-pressed")'), 'true');
  assert.equal(await evalView('document.querySelector(".log-viewer-log-scroll").contains(document.querySelector(".log-viewer-column-header"))'), false);
  assert.equal(await evalView(`(() => {
    const scroll = document.querySelector('.log-viewer-log-scroll');
    const header = document.querySelector('.log-viewer-column-header');
    const panel = document.querySelector('.log-viewer-surface');
    return scroll.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1 &&
      scroll.getBoundingClientRect().bottom < panel.getBoundingClientRect().bottom - 4;
  })()`), true);
  assert.equal(await evalView(`(() => {
    const header = document.querySelector('.log-viewer-header-viewport');
    const panel = document.querySelector('.log-viewer-log-panel');
    return Math.abs(header.getBoundingClientRect().right - panel.getBoundingClientRect().right) < 1 &&
      getComputedStyle(header).backgroundColor !== 'rgba(0, 0, 0, 0)';
  })()`), true, 'Header paints all the way across the data scrollbar gutter');
  await evalView(`window.retainedRow=document.querySelector('.log-viewer-entry');
    window.retainedScroll=document.querySelector('.log-viewer-log-scroll');
    retainedScroll.scrollTop=0; retainedScroll.scrollLeft=80;
    retainedScroll.dispatchEvent(new Event('scroll'));`);
  entries.push({ ...entries[0], id: 'new', message: '<script>should remain text</script>' });
  await pause(1600);
  assert.equal(await evalView('document.querySelectorAll(".log-viewer-entry").length'), 141);
  assert.equal(await evalView('retainedRow===document.querySelector(".log-viewer-entry") && retainedScroll===document.querySelector(".log-viewer-log-scroll")'), true);
  assert.equal(await evalView('retainedScroll.scrollTop'), 0);
  await evalView(`document.querySelector('.log-viewer-file.is-selected').click();
    document.querySelector('[title="${labels.en.refresh}"]').click();`);
  await pause(100);
  assert.equal(await evalView('retainedRow===document.querySelector(".log-viewer-entry")'), true);
  await pause(2600); // Cross a history refresh without resetting the table or selection.
  assert.equal(await evalView('retainedRow===document.querySelector(".log-viewer-entry")'), true);
  assert.equal(await evalView('document.querySelectorAll(".log-viewer-file.is-selected").length'), 1);
  const alignment = await evalView(`(() => {
    const h=document.querySelector('.log-viewer-header-cell').getBoundingClientRect();
    const r=document.querySelector('.log-viewer-timestamp').getBoundingClientRect();
    return Math.abs(h.left-r.left);
  })()`);
  assert.ok(alignment < 2, `Horizontal header alignment: ${alignment}`);
  await evalView(`retainedScroll.scrollTop=retainedScroll.scrollHeight;retainedScroll.dispatchEvent(new Event('scroll'));`);
  entries.push({ ...entries[0], id: 'tail', message: 'Follow latest' });
  await pause(1400);
  assert.equal(await evalView('retainedScroll.scrollHeight-retainedScroll.scrollTop-retainedScroll.clientHeight<40'), true);
  const originalId = contents.id;
  for (let i = 0; i < 3; i++) {
    parent.show();
    await moveByButton(labels.en.detach);
    assert.equal(manager.getState().detached, true);
    const detached = BrowserWindow.getAllWindows().find(win => win !== parent);
    assert.ok(detached);
    assert.equal(detached.getParentWindow(), null);
    assert.ok(detached.contentView.children.includes(view));
    assert.equal(contents.id, originalId);
    assert.equal(await evalView('retainedRow===document.querySelector(".log-viewer-entry")'), true);
    assert.equal(await evalView('getComputedStyle(document.querySelector(".log-viewer-header")).webkitAppRegion'), 'drag');
    // The app may close every overlay while the independent viewer is in use.
    underlying.setVisible(i === 0);
    if (i === 2) parent.minimize();
    await moveByButton(labels.en.attach);
    assert.ok(parent.contentView.children.includes(view));
    assert.equal(manager.getState().detached, false);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert.equal(parent.isMinimized(), false);
    assert.equal(underlying.getVisible(), i === 0, 'Docking must not reopen hidden menu/preferences');
    assert.equal(parent.contentView.children.at(-1), view, 'Viewer must stay above current app content');
    assert.equal(contents.isFocused(), true, 'Docking restores input without a focus-only click');
    assert.equal(await evalView('getComputedStyle(document.querySelector(".log-viewer-header")).webkitAppRegion'), 'no-drag');
    const beforeRefresh = readCount;
    await clickButton(labels.en.refresh);
    for (let j = 0; j < 20 && readCount === beforeRefresh; j++) await pause(10);
    assert.ok(readCount > beforeRefresh, 'First refresh click after docking must work');
  }
  assert.equal(restoredFocus, 0);
  if (process.env.KAWAIKARA_LOG_VIEWER_CAPTURE === '1') {
    const file = path.join(fixture, 'docked.png');
    writeFileSync(file, (await contents.capturePage()).toPNG());
    console.log(`Layout capture: ${file}`);
  }
  appearance = { theme: 'light', locale: 'ko' };
  manager.notifyAppearance();
  await pause(100);
  assert.equal(await evalView('Boolean(document.querySelector(".kawai-theme-light"))'), true);
  assert.equal(await evalView(`Boolean(document.querySelector('[title="${labels.ko.detach}"]'))`), true);
  const beforeClose = readCount;
  await clickButton(labels.ko.close);
  for (let i = 0; i < 50 && !contents.isDestroyed(); i++) await pause(20);
  assert.ok(contents.isDestroyed());
  assert.equal(restoredFocus, 1);
  assert.equal(underlying.getVisible(), false, 'X closes only the log layer');
  assert.equal(parent.webContents.isFocused(), true, 'X focuses the site when overlays are closed');
  await pause(1400);
  assert.equal(readCount, beforeClose);
  // Preferences left open before detaching stay open, but are never reopened.
  underlying.setVisible(true);
  await manager.open();
  await manager.toggle();
  await manager.toggle();
  const secondView = parent.contentView.children.at(-1).webContents;
  await clickButton(labels.ko.close, secondView);
  for (let i = 0; i < 50 && !secondView.isDestroyed(); i++) await pause(20);
  assert.ok(secondView.isDestroyed());
  assert.equal(underlying.getVisible(), true);
  assert.equal(underlying.webContents.isFocused(), true);
  await manager.open();
  await manager.toggle();
  await pause(150);
  BrowserWindow.getAllWindows().find(win => win !== parent).close();
  await pause(150);
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  await manager.open();
  const moving = manager.toggle();
  assert.equal(manager.toggle(), moving, 'Repeated toggle clicks share one transfer');
  manager.dispose();
  await moving;
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  underlying.webContents.close();
  parent.destroy();
  console.log('PASS: initial selection, stable append, full-width header, contained scrollbars, column alignment, first-click detach/attach/refresh/close, unchanged underlying layers, appearance, cleanup.');
  clearTimeout(timeout); app.exit(0);
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });
