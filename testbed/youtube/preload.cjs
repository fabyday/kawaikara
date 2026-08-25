const { contextBridge } = require('electron');

const mode = readRendererArgument('testbed-mode') || 'raw';
const configuration = createIdentityConfiguration();

if (mode === 'legacy-exact' || mode === 'legacy-combined') {
  // This intentionally mirrors main's historical mechanism: mutate the
  // preload world's Navigator object directly while contextIsolation is on.
  applyNavigatorIdentity(configuration);
}
if (mode === 'main-world') {
  contextBridge.executeInMainWorld({
    func: applyNavigatorIdentity,
    args: [configuration],
  });
}

void logPreloadWorldIdentity();

function createIdentityConfiguration() {
  const chromeVersion = readRendererArgument('testbed-chrome') ||
    process.versions.chrome ||
    '0.0.0.0';
  const chromeMajorVersion = chromeVersion.split('.')[0];
  const platform = readRendererArgument('testbed-platform') || process.platform;
  const architecture = readRendererArgument('testbed-arch') || process.arch;
  return {
    userAgent: navigator.userAgent
      .replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '')
      .replace(/\sElectronGoogleLoginTestbed\([^)]*\)\/[^\s]+/gi, '')
      .trim(),
    navigatorPlatform: platform === 'darwin'
      ? 'MacIntel'
      : platform === 'win32'
        ? 'Win32'
        : 'Linux x86_64',
    uaDataPlatform: platform === 'darwin'
      ? 'macOS'
      : platform === 'win32'
        ? 'Windows'
        : 'Linux',
    architecture: architecture === 'arm64'
      ? 'arm'
      : architecture === 'x64'
        ? 'x86'
        : architecture,
    chromeVersion,
    chromeMajorVersion,
  };
}

function applyNavigatorIdentity(config) {
  const brands = [
    { brand: 'Chromium', version: config.chromeMajorVersion },
    { brand: 'Google Chrome', version: config.chromeMajorVersion },
    { brand: 'Not-A.Brand', version: '99' },
  ];
  const fullVersionList = [
    { brand: 'Chromium', version: config.chromeVersion },
    { brand: 'Google Chrome', version: config.chromeVersion },
    { brand: 'Not-A.Brand', version: '99.0.0.0' },
  ];
  const userAgentData = {
    brands,
    mobile: false,
    platform: config.uaDataPlatform,
    getHighEntropyValues: async (hints) => {
      const values = {
        architecture: config.architecture,
        bitness: '64',
        brands,
        fullVersionList,
        mobile: false,
        model: '',
        platform: config.uaDataPlatform,
        platformVersion: config.uaDataPlatform === 'macOS'
          ? '13.3.1'
          : config.uaDataPlatform === 'Windows'
            ? '10.0.0'
            : '5.15.0',
        uaFullVersion: config.chromeVersion,
        wow64: false,
      };
      const result = {
        brands,
        mobile: false,
        platform: config.uaDataPlatform,
      };
      for (const hint of hints) {
        if (hint in values) result[hint] = values[hint];
      }
      return result;
    },
    toJSON: () => ({
      brands,
      mobile: false,
      platform: config.uaDataPlatform,
    }),
  };

  Object.defineProperties(navigator, {
    userAgent: {
      configurable: true,
      get: () => config.userAgent,
    },
    platform: {
      configurable: true,
      get: () => config.navigatorPlatform,
    },
    userAgentData: {
      configurable: true,
      get: () => userAgentData,
    },
  });
}

async function logPreloadWorldIdentity() {
  const data = navigator.userAgentData;
  let highEntropy = null;
  try {
    highEntropy = await data?.getHighEntropyValues?.([
      'architecture',
      'bitness',
      'fullVersionList',
      'platformVersion',
      'uaFullVersion',
      'wow64',
    ]);
  } catch (error) {
    highEntropy = { error: String(error) };
  }
  console.log(`[Testbed/Preload] ${JSON.stringify({
    mode,
    url: `${location.origin}${location.pathname}`,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    webdriver: navigator.webdriver,
    brands: data?.brands ?? null,
    mobile: data?.mobile ?? null,
    uaDataPlatform: data?.platform ?? null,
    highEntropy,
  })}`);
}

function readRendererArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}
