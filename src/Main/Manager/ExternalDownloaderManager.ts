import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, dialog, net, shell } from 'electron';
import type {
  ExternalDownloaderInstallResult,
  ExternalDownloaderOpenResult,
  ExternalDownloaderPlatform,
  ExternalDownloaderStatus,
} from '../../Common/Download';

const APP_NAME = 'YT Section Downloader';
const APP_BUNDLE_NAME = `${APP_NAME}.app`;
const APP_BUNDLE_ID = 'com.ytdownloader.app';
const PROTOCOL = 'yt-downloader';
const RELEASES_PAGE = 'https://github.com/fabyday/yt-downloader/releases';
const DEFAULT_MANIFEST_URL = `${RELEASES_PAGE}/latest/download/release-manifest.json`;
const SUPPORTED_ARTIFACT_KINDS = new Set(['dmg', 'zip', 'exe']);

interface ReleaseManifest {
  readonly version: string;
  readonly artifacts: ReleaseArtifact[];
}

interface ReleaseArtifact {
  readonly platform: ExternalDownloaderPlatform;
  readonly arch: string;
  readonly kind: 'dmg' | 'zip' | 'exe';
  readonly url: string;
  readonly sha256: string;
}

interface InstalledApp {
  readonly path?: string;
  readonly version?: string;
}

export class ExternalDownloaderManager {
  private installPromise?: Promise<ExternalDownloaderInstallResult>;

  async getStatus(message?: string): Promise<ExternalDownloaderStatus> {
    const platform = getPlatform();
    const installed = await findInstalledApp(platform);
    return {
      installed: Boolean(installed),
      automaticInstallSupported: platform === 'darwin' || platform === 'win32',
      platform,
      version: installed?.version,
      appPath: installed?.path,
      message,
    };
  }

  async open(value: unknown): Promise<ExternalDownloaderOpenResult> {
    const sourceUrl = requireYouTubeUrl(value);
    const status = await this.getStatus();
    if (!status.installed) return { opened: false, status };

    const deepLink = createDeepLink(sourceUrl);
    if (status.platform === 'darwin' && status.appPath) {
      await runCommand('/usr/bin/open', ['-a', status.appPath, deepLink]);
    } else if (status.platform === 'win32' && status.appPath) {
      const child = spawn(status.appPath, [deepLink], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
    } else {
      await shell.openExternal(deepLink);
    }
    return { opened: true, status };
  }

  install(value?: unknown): Promise<ExternalDownloaderInstallResult> {
    if (!this.installPromise) {
      this.installPromise = this.installOnce(value).finally(() => {
        this.installPromise = undefined;
      });
    }
    return this.installPromise;
  }

  async openReleasePage(): Promise<void> {
    await shell.openExternal(RELEASES_PAGE);
  }

  private async installOnce(
    value?: unknown,
  ): Promise<ExternalDownloaderInstallResult> {
    const sourceUrl = value === undefined || value === ''
      ? undefined
      : requireYouTubeUrl(value);
    const current = await this.getStatus();
    if (current.installed) {
      const openResult = sourceUrl
        ? await this.open(sourceUrl)
        : { opened: false, status: current };
      return {
        canceled: false,
        installerStarted: false,
        opened: openResult.opened,
        status: openResult.status,
      };
    }

    if (!current.automaticInstallSupported) {
      return {
        canceled: false,
        installerStarted: false,
        opened: false,
        status: await this.getStatus(
          '이 운영체제에서는 자동 설치를 지원하지 않습니다. 릴리스 페이지에서 설치해 주세요.',
        ),
      };
    }

    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: `${APP_NAME} 설치`,
      message: `${APP_NAME}를 다운로드하고 설치할까요?`,
      detail:
        current.platform === 'darwin'
          ? '릴리스 파일의 SHA-256을 확인한 뒤, 다운로드한 파일과 설치할 앱에서 macOS 격리 속성을 제거합니다. 관리자 권한은 사용하지 않으며 ~/Applications에만 설치합니다.'
          : '릴리스 파일의 SHA-256을 확인한 뒤 Windows 설치 프로그램을 실행합니다.',
      buttons: ['설치', '취소'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) {
      return {
        canceled: true,
        installerStarted: false,
        opened: false,
        status: current,
      };
    }

    const manifest = await fetchReleaseManifest();
    const artifact = selectArtifact(manifest, current.platform, process.arch);
    if (current.platform === 'darwin') {
      const installed = await installMacArtifact(manifest, artifact);
      const status = await this.getStatus(
        `YT Downloader ${installed.version ?? manifest.version} 설치가 완료되었습니다.`,
      );
      const openResult = sourceUrl
        ? await this.open(sourceUrl)
        : { opened: false, status };
      return {
        canceled: false,
        installerStarted: false,
        opened: openResult.opened,
        status: { ...openResult.status, message: status.message },
      };
    }

    const installerPath = await downloadWindowsInstaller(manifest, artifact);
    const launchError = await shell.openPath(installerPath);
    if (launchError) throw new Error(launchError);
    return {
      canceled: false,
      installerStarted: true,
      opened: false,
      status: await this.getStatus(
        'Windows 설치 프로그램을 열었습니다. 설치가 끝나면 다시 실행해 주세요.',
      ),
    };
  }
}

async function fetchReleaseManifest(): Promise<ReleaseManifest> {
  const manifestUrl =
    process.env.YT_DOWNLOADER_RELEASE_MANIFEST_URL?.trim() ||
    DEFAULT_MANIFEST_URL;
  requireHttpsUrl(manifestUrl, 'Release manifest');
  const response = await net.fetch(manifestUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(
      `YT Downloader release manifest request failed (${response.status}).`,
    );
  }
  return parseManifest(await response.json());
}

function parseManifest(value: unknown): ReleaseManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('YT Downloader release manifest is invalid.');
  }
  const candidate = value as Partial<ReleaseManifest>;
  if (
    typeof candidate.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(candidate.version) ||
    !Array.isArray(candidate.artifacts)
  ) {
    throw new Error('YT Downloader release manifest is invalid.');
  }
  const artifacts = candidate.artifacts.map((artifact) => {
    if (!artifact || typeof artifact !== 'object') {
      throw new Error('YT Downloader release artifact is invalid.');
    }
    const item = artifact as Partial<ReleaseArtifact>;
    if (
      !['darwin', 'win32', 'linux'].includes(item.platform ?? '') ||
      typeof item.arch !== 'string' ||
      !SUPPORTED_ARTIFACT_KINDS.has(item.kind ?? '') ||
      typeof item.url !== 'string' ||
      typeof item.sha256 !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(item.sha256)
    ) {
      throw new Error('YT Downloader release artifact is invalid.');
    }
    requireReleaseArtifactUrl(item.url);
    return item as ReleaseArtifact;
  });
  return { version: candidate.version, artifacts };
}

function selectArtifact(
  manifest: ReleaseManifest,
  platform: ExternalDownloaderPlatform,
  arch: string,
): ReleaseArtifact {
  const preferredKinds = platform === 'darwin' ? ['dmg', 'zip'] : ['exe'];
  for (const kind of preferredKinds) {
    const artifact = manifest.artifacts.find(
      (candidate) =>
        candidate.platform === platform &&
        (candidate.arch === arch || candidate.arch === 'universal') &&
        candidate.kind === kind,
    );
    if (artifact) return artifact;
  }
  throw new Error(`No YT Downloader release is available for ${platform}/${arch}.`);
}

async function installMacArtifact(
  manifest: ReleaseManifest,
  artifact: ReleaseArtifact,
): Promise<InstalledApp> {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(app.getPath('temp'), 'kawaikara-ytd-install-'),
  );
  const archivePath = path.join(temporaryDirectory, `download.${artifact.kind}`);
  const extractPath = path.join(temporaryDirectory, 'extract');
  let mounted = false;

  try {
    await downloadVerifiedArtifact(artifact, archivePath);
    await removeQuarantine(archivePath, false);

    if (artifact.kind === 'dmg') {
      await fs.mkdir(extractPath);
      await runCommand('/usr/bin/hdiutil', [
        'attach',
        '-readonly',
        '-nobrowse',
        '-mountpoint',
        extractPath,
        archivePath,
      ]);
      mounted = true;
    } else if (artifact.kind === 'zip') {
      await fs.mkdir(extractPath);
      await runCommand('/usr/bin/ditto', ['-x', '-k', archivePath, extractPath]);
    } else {
      throw new Error(`Unsupported macOS release artifact: ${artifact.kind}`);
    }

    const sourceApp = await findSingleAppBundle(extractPath);
    const sourceMetadata = await inspectMacApp(sourceApp);
    if (!sourceMetadata) {
      throw new Error(`The downloaded app bundle is not ${APP_NAME}.`);
    }

    const applicationsDirectory = path.join(app.getPath('home'), 'Applications');
    await fs.mkdir(applicationsDirectory, { recursive: true });
    const targetApp = path.join(applicationsDirectory, APP_BUNDLE_NAME);
    const stagingApp = path.join(
      applicationsDirectory,
      `.YT-Section-Downloader-${process.pid}-${Date.now()}.app`,
    );
    await runCommand('/usr/bin/ditto', [sourceApp, stagingApp]);
    try {
      const stagingMetadata = await inspectMacApp(stagingApp);
      if (!stagingMetadata) {
        throw new Error('The staged YT Downloader app failed identity validation.');
      }
      await removeQuarantine(stagingApp, true);
      if (await pathExists(targetApp)) {
        await shell.trashItem(targetApp);
      }
      await fs.rename(stagingApp, targetApp);
    } catch (error) {
      await fs.rm(stagingApp, { recursive: true, force: true });
      throw error;
    }

    const installed = await inspectMacApp(targetApp);
    if (!installed) throw new Error('YT Downloader installation validation failed.');
    return { ...installed, version: installed.version ?? manifest.version };
  } finally {
    if (mounted) {
      await runCommand('/usr/bin/hdiutil', ['detach', extractPath]).catch(
        () => undefined,
      );
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function downloadWindowsInstaller(
  manifest: ReleaseManifest,
  artifact: ReleaseArtifact,
): Promise<string> {
  if (artifact.kind !== 'exe') {
    throw new Error(`Unsupported Windows release artifact: ${artifact.kind}`);
  }
  const filePath = path.join(
    app.getPath('downloads'),
    `YT-Section-Downloader-${manifest.version}-${artifact.arch}.exe`,
  );
  await downloadVerifiedArtifact(artifact, filePath);
  return filePath;
}

async function downloadVerifiedArtifact(
  artifact: ReleaseArtifact,
  destination: string,
): Promise<void> {
  const response = await net.fetch(artifact.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`YT Downloader download failed (${response.status}).`);
  }
  const body = Readable.fromWeb(
    response.body as unknown as import('node:stream/web').ReadableStream,
  );
  await pipeline(body, createWriteStream(destination, { mode: 0o600 }));
  const actualHash = await sha256(destination);
  if (actualHash !== artifact.sha256.toLowerCase()) {
    await fs.rm(destination, { force: true });
    throw new Error('YT Downloader SHA-256 verification failed.');
  }
}

async function findInstalledApp(
  platform: ExternalDownloaderPlatform,
): Promise<InstalledApp | null> {
  if (platform === 'darwin') {
    const candidates = [
      process.env.YT_DOWNLOADER_APP_PATH?.trim(),
      path.join(app.getPath('home'), 'Applications', APP_BUNDLE_NAME),
      path.join('/Applications', APP_BUNDLE_NAME),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const installed = await inspectMacApp(path.resolve(candidate));
      if (installed) return installed;
    }
    try {
      const output = await runCommand('/usr/bin/mdfind', [
        `kMDItemCFBundleIdentifier == '${APP_BUNDLE_ID}'`,
      ]);
      for (const candidate of output.split(/\r?\n/)) {
        if (!candidate.endsWith('.app')) continue;
        const installed = await inspectMacApp(candidate);
        if (installed) return installed;
      }
    } catch {
      // The known install locations above are enough when Spotlight is disabled.
    }
    return null;
  }

  if (platform === 'win32') {
    const candidates = [
      process.env.YT_DOWNLOADER_APP_PATH?.trim(),
      process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            'Programs',
            'yt-section-downloader',
            `${APP_NAME}.exe`,
          )
        : undefined,
      process.env.PROGRAMFILES
        ? path.join(process.env.PROGRAMFILES, APP_NAME, `${APP_NAME}.exe`)
        : undefined,
    ];
    for (const candidate of candidates) {
      if (candidate && (await isFile(candidate))) return { path: candidate };
    }
    try {
      await runCommand('reg.exe', [
        'query',
        'HKCU\\Software\\Classes\\yt-downloader\\shell\\open\\command',
        '/ve',
      ]);
      return {};
    } catch {
      return null;
    }
  }

  try {
    const output = await runCommand('xdg-mime', [
      'query',
      'default',
      'x-scheme-handler/yt-downloader',
    ]);
    return output.trim() ? {} : null;
  } catch {
    return null;
  }
}

async function inspectMacApp(appPath: string): Promise<InstalledApp | null> {
  try {
    if (!(await fs.stat(appPath)).isDirectory()) return null;
    const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
    const bundleId = (
      await runCommand('/usr/bin/plutil', [
        '-extract',
        'CFBundleIdentifier',
        'raw',
        '-o',
        '-',
        infoPlist,
      ])
    ).trim();
    if (bundleId !== APP_BUNDLE_ID) return null;
    const version = (
      await runCommand('/usr/bin/plutil', [
        '-extract',
        'CFBundleShortVersionString',
        'raw',
        '-o',
        '-',
        infoPlist,
      ])
    ).trim();
    return { path: appPath, version: version || undefined };
  } catch {
    return null;
  }
}

async function findSingleAppBundle(directory: string): Promise<string> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const apps = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => path.join(directory, entry.name));
  if (apps.length !== 1) {
    throw new Error('The release must contain exactly one top-level app bundle.');
  }
  return apps[0];
}

async function removeQuarantine(target: string, recursive: boolean): Promise<void> {
  try {
    await runCommand('/usr/bin/xattr', [
      recursive ? '-dr' : '-d',
      'com.apple.quarantine',
      target,
    ]);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!/No such xattr|No such file/i.test(message)) throw error;
  }
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function createDeepLink(sourceUrl: string): string {
  const deepLink = new URL(`${PROTOCOL}://open`);
  deepLink.searchParams.set('url', sourceUrl);
  return deepLink.toString();
}

function requireYouTubeUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('YouTube URL is required.');
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (
      url.protocol !== 'https:' ||
      ![
        'youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtu.be',
      ].includes(host)
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new TypeError('A valid HTTPS YouTube URL is required.');
  }
}

function requireHttpsUrl(value: string, label: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} URL is invalid.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label} URL must use HTTPS.`);
  }
}

function requireReleaseArtifactUrl(value: string): void {
  requireHttpsUrl(value, 'Release artifact');
  const url = new URL(value);
  if (
    url.hostname !== 'github.com' ||
    !url.pathname.startsWith('/fabyday/yt-downloader/releases/')
  ) {
    throw new Error('Release artifact must belong to fabyday/yt-downloader.');
  }
}

function getPlatform(): ExternalDownloaderPlatform {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return process.platform;
  }
  return 'linux';
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${path.basename(command)} exited with code ${code}: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}
