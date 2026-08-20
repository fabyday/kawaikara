const {
  app,
  BrowserWindow,
  desktopCapturer,
  systemPreferences,
} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');

const sourceArgument = process.argv.slice(2).find((argument) => argument !== '--');
const source = sourceArgument
  ? path.resolve(sourceArgument)
  : process.env.MPV_SMOKE_SOURCE;
if (!source || !path.isAbsolute(source)) {
  throw new Error(
    'Pass a video path as the first argument or set MPV_SMOKE_SOURCE to an absolute path.',
  );
}

process.env.MPV_HWDEC ??= 'auto-safe';
const electronGpuDisabled = process.env.CAPTURE_PROBE_DISABLE_GPU === '1';
if (electronGpuDisabled) {
  app.disableHardwareAcceleration();
} else {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}
app.setPath('userData', path.join(os.tmpdir(), 'kawaikara-capture-probe-user-data'));

function withTimeout(promise, label, timeout = 30_000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout);
    }),
  ]).finally(() => clearTimeout(timer));
}

function summarize(image) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  let count = 0;
  let sum = 0;
  let sumSquares = 0;
  let colorful = 0;

  for (let y = Math.floor(size.height * 0.18); y < size.height; y += 2) {
    for (let x = 0; x < size.width; x += 2) {
      const offset = (y * size.width + x) * 4;
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const brightness = (r + g + b) / 3;
      sum += brightness;
      sumSquares += brightness * brightness;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colorful += 1;
      count += 1;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? sumSquares / count - mean * mean : 0;
  return {
    width: size.width,
    height: size.height,
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(Math.sqrt(Math.max(0, variance)).toFixed(2)),
    colorfulRatio: Number((count > 0 ? colorful / count : 0).toFixed(4)),
    containsTestVideo: mean > 30 && variance > 500 && colorful / count > 0.05,
  };
}

async function captureDesktopWindow(window, mode, outputDirectory) {
  const mediaSourceId = window.getMediaSourceId();
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: window.getContentSize().reduce(
      (size, value, index) => ({ ...size, [index === 0 ? 'width' : 'height']: value }),
      {},
    ),
    fetchWindowIcons: false,
  });
  const selected = sources.find((candidate) => candidate.id === mediaSourceId);
  if (!selected) {
    throw new Error(
      `The probe window was not returned by desktopCapturer (${mediaSourceId}). ` +
        `Available sources: ${sources.map((candidate) => `${candidate.name}:${candidate.id}`).join(', ')}`,
    );
  }
  const filePath = path.join(outputDirectory, `${mode}-desktop.png`);
  fs.writeFileSync(filePath, selected.thumbnail.toPNG());
  return { filePath, metrics: summarize(selected.thumbnail) };
}

async function capturePage(window, mode, outputDirectory) {
  const image = await window.webContents.capturePage();
  const filePath = path.join(outputDirectory, `${mode}-capture-page.png`);
  fs.writeFileSync(filePath, image.toPNG());
  return { filePath, metrics: summarize(image) };
}

async function run() {
  const { createMpvMain } = await import('electron-mpv-video/main');
  const mpv = createMpvMain();
  const outputDirectory = path.join(os.tmpdir(), 'kawaikara-capture-probe');
  fs.mkdirSync(outputDirectory, { recursive: true });

  const window = new BrowserWindow({
    width: Number(process.env.CAPTURE_PROBE_WIDTH) || 800,
    height: Number(process.env.CAPTURE_PROBE_HEIGHT) || 500,
    show: true,
    title: 'Kawaikara Capture Probe',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false,
    },
  });
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    process.stderr.write(`[preload-error] ${preloadPath}: ${error.stack || error.message}\n`);
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    process.stderr.write(`[did-fail-load] ${code}: ${description}\n`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`[render-process-gone] ${JSON.stringify(details)}\n`);
  });
  mpv.attachWindow(window);
  await withTimeout(
    window.loadFile(path.join(__dirname, 'renderer.html'), {
      query: {
        softwareLimit:
          process.env.CAPTURE_PROBE_SOFTWARE_LIMIT === '1' ? '1' : '0',
      },
    }),
    'renderer load',
  );

  if (process.env.CAPTURE_PROBE_HOLD === '1') {
    const holdMode = process.env.CAPTURE_PROBE_MODE ??
      (electronGpuDisabled ? 'canvas2d' : 'shared-texture');
    await withTimeout(
      window.webContents.executeJavaScript(
        `window.runCaptureProbe(${JSON.stringify(holdMode)}, ${JSON.stringify(source)})`,
        true,
      ),
      `held ${holdMode} renderer`,
      35_000,
    );
    process.stdout.write('CAPTURE_PROBE_READY\n');
    await new Promise(() => undefined);
  }

  const results = [];
  const modes = electronGpuDisabled
    ? ['canvas2d']
    : ['shared-texture', 'webgl'];
  for (const mode of modes) {
    const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
    const eventLoopStart = performance.eventLoopUtilization();
    eventLoopDelay.enable();
    const renderer = await withTimeout(
      window.webContents.executeJavaScript(
        `window.runCaptureProbe(${JSON.stringify(mode)}, ${JSON.stringify(source)})`,
        true,
      ),
      `${mode} renderer`,
      35_000,
    );
    eventLoopDelay.disable();
    const eventLoopUtilization = performance.eventLoopUtilization(eventLoopStart);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    results.push({
      mode,
      renderer,
      mainEventLoop: {
        utilization: eventLoopUtilization.utilization,
        meanDelayMilliseconds: eventLoopDelay.mean / 1_000_000,
        maxDelayMilliseconds: eventLoopDelay.max / 1_000_000,
      },
      capturePage: await capturePage(window, mode, outputDirectory),
      desktopCapturer: await captureDesktopWindow(window, mode, outputDirectory),
    });
  }

  const report = {
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    electronGpuDisabled,
    gpuFeatureStatus: app.getGPUFeatureStatus(),
    mpvHwdec: process.env.MPV_HWDEC ?? 'auto-safe',
    screenPermission:
      process.platform === 'darwin'
        ? systemPreferences.getMediaAccessStatus('screen')
        : 'not-applicable',
    outputDirectory,
    results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  await mpv.detachWindow(window);
  window.destroy();
  await mpv.dispose();
  app.quit();
}

app.whenReady().then(run).catch((error) => {
  process.stderr.write(`${error?.stack || String(error)}\n`);
  app.exit(1);
});
