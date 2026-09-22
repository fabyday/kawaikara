// Render the real React buttons and shipped CSS in isolated Chromium. Never
// import the application entry point or open external developer-link URLs.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-developer-links-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara Developer Links Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const watchdog = setTimeout(() => {
  console.error('Developer-links Chromium probe timed out.');
  app.exit(1);
}, 30000);

const fixture = buildSync({
  stdin: {
    contents: `
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { KawaiProvider } from '@kawaikara/kawai-ui';
      import { DeveloperLinks } from './src/Renderer/View/Preference/DeveloperLinks';
      const messages = { homepage: 'Homepage', youtube: 'YouTube', website: 'Homepage', github: 'GitHub', discord: 'Discord',
        developerYouTube: 'Developer YouTube', liveNow: 'Live now', offline: 'Offline',
        liveStatusUnavailable: 'Unavailable', checkingLive: 'Checking' };
      const states = { live: { isLive: true, checkedAt: '2026-09-17T00:00:00Z' },
        offline: { isLive: false, checkedAt: '2026-09-17T00:00:00Z' },
        checking: undefined,
        unavailable: { isLive: false, checkedAt: '2026-09-17T00:00:00Z', error: 'Unavailable' } };
      window.openedLinks = [];
      flushSync(() => createRoot(document.getElementById('root')).render(
        <KawaiProvider>
          <div className="probe-themes">
            {['light', 'dark'].map(theme => (
              <section key={theme} className={'probe-theme kawai-theme kawai-theme-' + theme}>
                <h1>{theme === 'light' ? 'Light theme' : 'Dark theme'}</h1>
                {Object.entries(states).map(([state, status]) => (
                  <div key={state} id={theme + '-' + state} className="probe-state">
                    <h2>{state}</h2>
                    <DeveloperLinks messages={messages} youtubeStatus={status}
                      onOpen={id => window.openedLinks.push(id)} />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </KawaiProvider>
      ));
    `,
    loader: 'jsx',
    resolveDir: root,
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  write: false,
  minify: process.argv.includes('--minified'),
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

// Fixture layout only; all button, icon, live-state, and hover styling comes
// from the same CSS imports as the application renderer.
const css = [
  readFileSync(require.resolve('@kawaikara/kawai-ui/styles.css'), 'utf8'),
  readFileSync(path.join(root, 'src/Renderer/Styles/Overlay.css'), 'utf8'),
  `body { padding: 24px; box-sizing: border-box; background: #ddd; }
   .probe-themes { display: grid; grid-template-columns: 390px 390px; gap: 24px; }
   .probe-theme { padding: 20px; border-radius: 16px; }
   .probe-theme.kawai-theme-light { background: #f8f7fb; color: var(--kawai-color-foreground); }
   .probe-theme.kawai-theme-dark { background: #18181b; color: #e4e4e7; }
   .probe-theme h1 { margin: 0 0 20px; font-size: 20px; }
   .probe-theme h2 { margin: 0 0 8px; font-size: 12px; }
   .probe-state + .probe-state { margin-top: 20px; }`,
].join('\n');

function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function compositeOverWhite(color) {
  const [red, green, blue, alpha = 1] = color.match(/[\d.]+/g).map(Number);
  return `rgb(${[red, green, blue].map(channel => channel * alpha + 255 * (1 - alpha)).join(', ')})`;
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ width: 860, height: 660, show: false, webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
  } });
  win.setContentSize(860, 660);
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
    `<style>${css}</style><div id="root"></div>`,
  )}`);
  const execute = source => win.webContents.executeJavaScript(source, true);
  await execute(fixture);
  await execute('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const debuggerClient = win.webContents.debugger;
  debuggerClient.attach('1.3');
  await debuggerClient.sendCommand('DOM.enable');
  await debuggerClient.sendCommand('CSS.enable');
  const { root: documentNode } = await debuggerClient.sendCommand('DOM.getDocument');

  const style = selector => execute(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing fixture node');
    const css = getComputedStyle(node);
    return { color: css.color, fill: css.fill, stroke: css.stroke,
      background: css.backgroundColor, image: css.backgroundImage,
      border: css.borderTopColor };
  })()`);
  const forceHover = async (selector, enabled) => {
    const { nodeId } = await debuggerClient.sendCommand('DOM.querySelector', {
      nodeId: documentNode.nodeId, selector,
    });
    assert.ok(nodeId, `button exists: ${selector}`);
    await debuggerClient.sendCommand('CSS.forcePseudoState', {
      nodeId, forcedPseudoClasses: enabled ? ['hover'] : [],
    });
    // Sample the completed hover style, not the first frame of the Button's
    // CSS color transition. Leave the infinite live-indicator animation alone.
    await execute(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      getComputedStyle(node).backgroundColor;
      for (const animation of node.getAnimations()) {
        if (animation instanceof CSSTransition) animation.finish();
      }
    })()`);
  };

  for (const theme of ['light', 'dark']) {
    for (const state of ['live', 'offline', 'checking', 'unavailable']) {
      const section = `#${theme}-${state}`;
      const github = `${section} .github-link .developer-link-icon`;
      assert.equal((await style(github)).color,
        theme === 'light' ? 'rgb(24, 24, 27)' : 'rgb(228, 228, 231)', `${theme} GitHub mark`);
      assert.equal((await style(`${github} svg`)).fill, (await style(github)).color);
      if (theme === 'light') {
        const iconStyle = await style(github);
        assert.ok(((luminance(compositeOverWhite(iconStyle.background)) + 0.05)
          / (luminance(iconStyle.color) + 0.05)) > 15,
          'light-theme GitHub mark has strong contrast against its light icon tile');
      }
      assert.equal((await style(`${section} .discord-link .developer-link-icon`)).color,
        'rgb(114, 137, 218)', 'Discord brand color is unchanged');
      assert.equal((await style(`${section} .youtube-icon-wrap > svg`)).fill,
        'rgb(255, 61, 79)', 'YouTube logo stays red');
      assert.equal((await style(`${section} .youtube-icon-wrap > svg path`)).fill,
        'rgb(255, 255, 255)', 'YouTube play triangle stays white');
      assert.equal(await execute(`document.querySelectorAll(${JSON.stringify(section + ' .youtube-live-dot')}).length`),
        state === 'live' ? 1 : 0, 'only a live stream shows a live badge');

      for (const buttonClass of ['github-link', 'discord-link', 'developer-youtube-link']) {
        const selector = `${section} .${buttonClass}`;
        for (const hovered of [false, true]) {
          await forceHover(selector, hovered);
          const button = await style(selector);
          if (state === 'live' && buttonClass === 'developer-youtube-link') {
            assert.match(button.image, /linear-gradient/);
            if (theme === 'light') {
              assert.match(button.image, hovered ? /rgb\(255, 241, 242\)/ : /rgb\(255, 255, 255\)/,
                'live and hovered-live highlights use light-theme gradient stops');
              assert.doesNotMatch(button.image, /rgb\(36, 36, 41\)/,
                'dark-theme YouTube background cannot leak into the light theme');
              assert.equal((await style(`${selector} .developer-youtube-status`)).color, 'rgb(190, 18, 60)');
              assert.equal((await style(`${selector} .youtube-live-dot`)).border, 'rgb(255, 255, 255)');
            } else {
              assert.match(button.image, /rgb\(36, 36, 41\)/, 'dark live highlight is preserved');
            }
          } else {
            assert.equal(button.image, 'none');
            assert.equal(button.background, theme === 'light'
              ? (hovered ? 'rgb(244, 241, 247)' : 'rgb(255, 255, 255)')
              : (hovered ? 'rgb(43, 43, 49)' : 'rgb(36, 36, 41)'), `${selector}: hovered=${hovered}`);
          }
          assert.equal((await style(github)).color,
            theme === 'light' ? 'rgb(24, 24, 27)' : 'rgb(228, 228, 231)', 'hover cannot wash out the GitHub mark');
        }
        await forceHover(selector, false);
      }
      await execute(`for (const button of document.querySelectorAll(${JSON.stringify(section + ' button')})) button.click()`);
    }
  }
  assert.deepEqual(await execute('window.openedLinks'),
    Array.from({ length: 8 }, () => ['website', 'github', 'discord', 'developerYouTube']).flat(),
    'all theme/status variants retain their link destinations');
  await execute(`document.querySelector('#light-live .developer-youtube-link').focus()`);
  assert.equal(await execute(`document.activeElement.matches('#light-live .developer-youtube-link')`), true,
    'YouTube remains keyboard-focusable');
  await execute('document.activeElement.blur()');
  if (process.argv.includes('--screenshot')) {
    const screenshot = path.join(profile, 'developer-links.png');
    writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    console.log(`Screenshot: ${screenshot}`);
  }
  debuggerClient.detach();
  win.destroy();
  console.log('PASS: Real React/CSS developer-link buttons in both themes and all four YouTube states, including hover, GitHub contrast, live indicators, keyboard focus, and link callbacks.');
}

main().then(() => { clearTimeout(watchdog); app.exit(0); }).catch(error => {
  console.error(error);
  clearTimeout(watchdog);
  app.exit(1);
});
