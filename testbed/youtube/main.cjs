const path = require('node:path');
const {
  app,
  BrowserWindow,
  shell,
  WebContentsView,
} = require('electron');

const MODES = new Set([
  'raw',
  'view-raw',
  'ua',
  'legacy-exact',
  'legacy-combined',
  'main-world',
]);
const mode = readArgument('mode') || 'raw';
if (!MODES.has(mode)) {
  throw new Error(`Unknown test mode: ${mode}`);
}
const startUrl = validateStartUrl(
  readArgument('url') || 'https://www.youtube.com/',
);
const openDevTools = process.argv.includes('--devtools');
const probePageWorld = process.argv.includes('--probe-page-world');
const smokeTest = process.argv.includes('--smoke');

// Every mode owns a separate browser profile. Results from one experiment can
// never authenticate or contaminate another mode unless the tester copies data.
app.setPath('userData', path.join(__dirname, '.profiles', mode));
app.setName(`Electron Google Login Testbed (${mode})`);

app.whenReady().then(() => {
  console.log('[Testbed/Main] Runtime', {
    mode,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    sandbox: !mode.startsWith('legacy-'),
    startUrl: formatUrl(startUrl),
  });

  const target = createTestTarget();
  installRequestDiagnostics(target.webContents);
  installNavigationDiagnostics(target.webContents);
  installWindowPolicy(target.webContents, target.loadURL);

  if (usesSanitizedUserAgent(mode)) {
    const originalUserAgent = target.webContents.getUserAgent();
    const sanitizedUserAgent = sanitizeUserAgent(originalUserAgent);
    target.webContents.setUserAgent(sanitizedUserAgent);
    console.log('[Testbed/Main] webContents user agent override installed', {
      original: originalUserAgent,
      effective: sanitizedUserAgent,
    });
  }

  if (openDevTools) {
    target.webContents.openDevTools({ mode: 'detach', activate: true });
  }
  if (smokeTest) {
    const timeout = setTimeout(() => {
      console.error('[Testbed/Smoke] Timed out before the page finished loading.');
      app.exit(1);
    }, 15_000);
    target.webContents.once('did-finish-load', () => {
      clearTimeout(timeout);
      console.log('[Testbed/Smoke] Page and preload loaded successfully.');
      setTimeout(() => app.quit(), 250);
    });
  }
  void target.loadURL(startUrl).catch((error) => {
    if (error?.code === 'ERR_ABORTED') {
      console.log(
        '[Testbed/Main] Initial document was replaced by an expected site redirect.',
      );
      return;
    }
    console.error('[Testbed/Main] Initial navigation failed', error);
    if (smokeTest) app.exit(1);
  });
});

app.on('window-all-closed', () => app.quit());

function createTestTarget() {
  const window = new BrowserWindow({
    show: !smokeTest,
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: `Electron Google Login Testbed — ${mode}`,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: mode === 'view-raw' ? undefined : createWebPreferences(),
  });
  if (mode !== 'view-raw') {
    return {
      window,
      webContents: window.webContents,
      loadURL: (url) => window.loadURL(url),
    };
  }

  // This is the same remote-content container topology used by Kawaikara:
  // an ordinary BrowserWindow owns a sandboxed WebContentsView.
  const view = new WebContentsView({
    webPreferences: createWebPreferences(),
  });
  window.contentView.addChildView(view);
  const updateBounds = () => {
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
  };
  updateBounds();
  window.on('resize', updateBounds);
  window.on('closed', () => {
    if (!view.webContents.isDestroyed()) view.webContents.close();
  });
  return {
    window,
    webContents: view.webContents,
    loadURL: (url) => view.webContents.loadURL(url),
  };
}

function createWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    // main's historical preload ran unsandboxed. Keep that distinction
    // visible instead of silently changing the experiment.
    sandbox: !mode.startsWith('legacy-'),
    additionalArguments: [
      `--testbed-mode=${mode}`,
      `--testbed-chrome=${process.versions.chrome}`,
      `--testbed-arch=${process.arch}`,
      `--testbed-platform=${process.platform}`,
    ],
  };
}

function installRequestDiagnostics(webContents) {
  let previousSignature = '';
  webContents.session.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.google.com/*',
        '*://google.com/*',
        '*://*.youtube.com/*',
        '*://youtube.com/*',
      ],
    },
    (details, callback) => {
      if (details.resourceType === 'mainFrame') {
        const userAgent = readHeader(details.requestHeaders, 'user-agent');
        const clientHint = readHeader(details.requestHeaders, 'sec-ch-ua');
        const platformHint = readHeader(
          details.requestHeaders,
          'sec-ch-ua-platform',
        );
        const signature = JSON.stringify([
          formatUrl(details.url),
          userAgent,
          clientHint,
          platformHint,
        ]);
        if (signature !== previousSignature) {
          previousSignature = signature;
          console.log('[Testbed/Request] Main-frame browser identity', {
            url: formatUrl(details.url),
            userAgent: userAgent || '<not sent>',
            secChUa: clientHint || '<not sent>',
            secChUaPlatform: platformHint || '<not sent>',
          });
        }
      }
      callback({ requestHeaders: details.requestHeaders });
    },
  );
}

function installNavigationDiagnostics(webContents) {
  webContents.on('did-start-navigation', (_event, url, inPlace, mainFrame) => {
    if (!mainFrame) return;
    console.log('[Testbed/Navigation] start', {
      url: formatUrl(url),
      inPlace,
    });
  });
  webContents.on('did-navigate', (_event, url) => {
    console.log('[Testbed/Navigation] committed', { url: formatUrl(url) });
  });
  webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, mainFrame) => {
      if (!mainFrame || errorCode === -3) return;
      console.error('[Testbed/Navigation] failed', {
        errorCode,
        errorDescription,
        url: formatUrl(validatedUrl),
      });
    },
  );
  webContents.on('console-message', (details) => {
    if (!details.message.startsWith('[Testbed/')) return;
    console.log(details.message);
  });
  webContents.on('dom-ready', () => {
    if (!probePageWorld) return;
    void webContents.executeJavaScript(createPageWorldProbe()).then((value) => {
      console.log('[Testbed/Probe] Page-world identity', value);
    }).catch((error) => {
      console.error('[Testbed/Probe] Page-world probe failed', error);
    });
  });
}

function installWindowPolicy(webContents, loadURL) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleOrYouTubeUrl(url)) {
      void loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function createPageWorldProbe() {
  return `(() => {
    const data = navigator.userAgentData;
    return Promise.resolve(
      data?.getHighEntropyValues?.([
        'architecture',
        'bitness',
        'fullVersionList',
        'model',
        'platformVersion',
        'uaFullVersion',
        'wow64',
      ]),
    ).then((highEntropy) => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      webdriver: navigator.webdriver,
      languages: [...navigator.languages],
      brands: data?.brands ?? null,
      mobile: data?.mobile ?? null,
      uaDataPlatform: data?.platform ?? null,
      highEntropy: highEntropy ?? null,
      chromeObject: typeof window.chrome,
      processObject: typeof window.process,
    }));
  })()`;
}

function usesSanitizedUserAgent(value) {
  return value === 'ua' ||
    value === 'legacy-combined' ||
    value === 'main-world';
}

function sanitizeUserAgent(value) {
  return value
    .replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '')
    .replace(/\sElectronGoogleLoginTestbed\([^)]*\)\/[^\s]+/gi, '')
    .trim();
}

function readHeader(headers, name) {
  const key = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name,
  );
  return key ? String(headers[key]) : '';
}

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function validateStartUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error('The testbed start URL must use HTTPS.');
  }
  return parsed.href;
}

function isGoogleOrYouTubeUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'google.com' ||
      hostname.endsWith('.google.com') ||
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

function formatUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '<unparseable-url>';
  }
}
