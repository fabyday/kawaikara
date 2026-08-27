import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, net, shell } from 'electron';
import type { ExternalDownloaderPlatform } from '../../Common/Download';

/** Defines the shared external downloader app name constant. */
export const EXTERNAL_DOWNLOADER_APP_NAME = 'YT Section Downloader';
/** Defines the shared external downloader releases page constant. */
export const EXTERNAL_DOWNLOADER_RELEASES_PAGE =
  'https://github.com/fabyday/yt-downloader/releases';
/** Defines the shared app bundle name constant. */
const APP_BUNDLE_NAME = `${EXTERNAL_DOWNLOADER_APP_NAME}.app`;
/** Defines the shared app bundle ID constant. */
const APP_BUNDLE_ID = 'com.ytdownloader.app';
/** Defines the shared protocol constant. */
const PROTOCOL = 'yt-downloader';
/** Defines the shared default manifest URL constant. */
const DEFAULT_MANIFEST_URL =
  `${EXTERNAL_DOWNLOADER_RELEASES_PAGE}/latest/download/release-manifest.json`;
/** Defines the shared supported artifact kinds constant. */
const SUPPORTED_ARTIFACT_KINDS = new Set(['dmg', 'zip', 'exe']);

/** Describes the external downloader release manifest contract. */
export interface ExternalDownloaderReleaseManifest {
  /** The version value. */
  readonly version: string;
  /** The artifacts value. */
  readonly artifacts: ExternalDownloaderReleaseArtifact[];
}

/** Describes the external downloader release artifact contract. */
export interface ExternalDownloaderReleaseArtifact {
  /** The platform value. */
  readonly platform: ExternalDownloaderPlatform;
  /** The arch value. */
  readonly arch: string;
  /** The kind value. */
  readonly kind: 'dmg' | 'zip' | 'exe';
  /** The URL value. */
  readonly url: string;
  /** The sha256 value. */
  readonly sha256: string;
}

/** Describes the installed external downloader app contract. */
export interface InstalledExternalDownloaderApp {
  /** The path value. */
  readonly path?: string;
  /** The version value. */
  readonly version?: string;
}

/** Performs the fetch external downloader release manifest operation. */
export async function fetchExternalDownloaderReleaseManifest(): Promise<
  ExternalDownloaderReleaseManifest
> {
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

/** Selects the external downloader artifact. */
export function selectExternalDownloaderArtifact(
  manifest: ExternalDownloaderReleaseManifest,
  platform: ExternalDownloaderPlatform,
  arch: string,
): ExternalDownloaderReleaseArtifact {
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

/** Installs the external downloader mac artifact. */
export async function installExternalDownloaderMacArtifact(
  manifest: ExternalDownloaderReleaseManifest,
  artifact: ExternalDownloaderReleaseArtifact,
): Promise<InstalledExternalDownloaderApp> {
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
      await runExternalDownloaderCommand('/usr/bin/hdiutil', [
        'attach', '-readonly', '-nobrowse', '-mountpoint', extractPath, archivePath,
      ]);
      mounted = true;
    } else if (artifact.kind === 'zip') {
      await fs.mkdir(extractPath);
      await runExternalDownloaderCommand(
        '/usr/bin/ditto',
        ['-x', '-k', archivePath, extractPath],
      );
    } else {
      throw new Error(`Unsupported macOS release artifact: ${artifact.kind}`);
    }

    const sourceApp = await findSingleAppBundle(extractPath);
    if (!(await inspectMacApp(sourceApp))) {
      throw new Error(`The downloaded app bundle is not ${EXTERNAL_DOWNLOADER_APP_NAME}.`);
    }
    const applicationsDirectory = path.join(app.getPath('home'), 'Applications');
    await fs.mkdir(applicationsDirectory, { recursive: true
    });
    const targetApp = path.join(applicationsDirectory, APP_BUNDLE_NAME);
    const stagingApp = path.join(
      applicationsDirectory,
      `.YT-Section-Downloader-${process.pid}-${Date.now()}.app`,
    );
    await runExternalDownloaderCommand('/usr/bin/ditto', [sourceApp, stagingApp]);
    try {
      if (!(await inspectMacApp(stagingApp))) {
        throw new Error('The staged YT Downloader app failed identity validation.');
      }
      await removeQuarantine(stagingApp, true);
      if (await pathExists(targetApp)) await shell.trashItem(targetApp);
      await fs.rename(stagingApp, targetApp);
    } catch (error) {
      await fs.rm(stagingApp, { recursive: true, force: true
      });
      throw error;
    }
    const installed = await inspectMacApp(targetApp);
    if (!installed) throw new Error('YT Downloader installation validation failed.');
    return { ...installed,
      /** The version value. */
      version: installed.version ?? manifest.version,
    };
  } finally {
    if (mounted) {
      await runExternalDownloaderCommand('/usr/bin/hdiutil', ['detach', extractPath])
        .catch(() => undefined);
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true
    });
  }
}

/** Performs the download external downloader Windows installer operation. */
export async function downloadExternalDownloaderWindowsInstaller(
  manifest: ExternalDownloaderReleaseManifest,
  artifact: ExternalDownloaderReleaseArtifact,
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

/** Finds the installed external downloader app. */
export async function findInstalledExternalDownloaderApp(
  platform: ExternalDownloaderPlatform,
): Promise<InstalledExternalDownloaderApp | null> {
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
      const output = await runExternalDownloaderCommand('/usr/bin/mdfind', [
        `kMDItemCFBundleIdentifier == '${APP_BUNDLE_ID}'`,
      ]);
      for (const candidate of output.split(/\r?\n/)) {
        if (!candidate.endsWith('.app')) continue;
        const installed = await inspectMacApp(candidate);
        if (installed) return installed;
      }
    } catch {
      // Known install locations are sufficient when Spotlight is disabled.
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
            `${EXTERNAL_DOWNLOADER_APP_NAME}.exe`,
          )
        : undefined,
      process.env.PROGRAMFILES
        ? path.join(
            process.env.PROGRAMFILES,
            EXTERNAL_DOWNLOADER_APP_NAME,
            `${EXTERNAL_DOWNLOADER_APP_NAME}.exe`,
          )
        : undefined,
    ];
    for (const candidate of candidates) {
      if (candidate && (await isFile(candidate))) return {
        /** The path value. */
        path: candidate,
      };
    }
    try {
      await runExternalDownloaderCommand('reg.exe', [
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
    const output = await runExternalDownloaderCommand('xdg-mime', [
      'query', 'default', 'x-scheme-handler/yt-downloader',
    ]);
    return output.trim() ? {} : null;
  } catch {
    return null;
  }
}

/** Creates the external downloader deep link. */
export function createExternalDownloaderDeepLink(sourceUrl: string): string {
  const deepLink = new URL(`${PROTOCOL}://open`);
  deepLink.searchParams.set('url', sourceUrl);
  return deepLink.toString();
}

/** Performs the require you tube URL operation. */
export function requireYouTubeUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('YouTube URL is required.');
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (
      url.protocol !== 'https:' ||
      !['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new TypeError('A valid HTTPS YouTube URL is required.');
  }
}

/** Returns the external downloader platform. */
export function getExternalDownloaderPlatform(): ExternalDownloaderPlatform {
  return process.platform === 'darwin' || process.platform === 'win32'
    ? process.platform
    : 'linux';
}

/** Runs the external downloader command. */
export function runExternalDownloaderCommand(
  command: string,
  args: readonly string[],
): Promise<string> {
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
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(stdout);
      else {
        reject(new Error(
          `${path.basename(command)} exited with code ${code}: ${stderr.trim()}`,
        ));
      }
    });
  });
}

/** Parses the manifest. */
function parseManifest(value: unknown): ExternalDownloaderReleaseManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('YT Downloader release manifest is invalid.');
  }
  const candidate = value as Partial<ExternalDownloaderReleaseManifest>;
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
    const item = artifact as Partial<ExternalDownloaderReleaseArtifact>;
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
    return item as ExternalDownloaderReleaseArtifact;
  });
  return {
    /** The version value. */
    version: candidate.version,
    /** The artifacts value. */
    artifacts,
  };
}

/** Performs the download verified artifact operation. */
async function downloadVerifiedArtifact(
  artifact: ExternalDownloaderReleaseArtifact,
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
  await pipeline(body, createWriteStream(destination, { mode: 0o600
  }));
  const actualHash = await sha256(destination);
  if (actualHash !== artifact.sha256.toLowerCase()) {
    await fs.rm(destination, { force: true
    });
    throw new Error('YT Downloader SHA-256 verification failed.');
  }
}

/** Performs the inspect mac app operation. */
async function inspectMacApp(
  appPath: string,
): Promise<InstalledExternalDownloaderApp | null> {
  try {
    if (!(await fs.stat(appPath)).isDirectory()) return null;
    const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
    const bundleId = (await runExternalDownloaderCommand('/usr/bin/plutil', [
      '-extract', 'CFBundleIdentifier', 'raw', '-o', '-', infoPlist,
    ])).trim();
    if (bundleId !== APP_BUNDLE_ID) return null;
    const version = (await runExternalDownloaderCommand('/usr/bin/plutil', [
      '-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', infoPlist,
    ])).trim();
    return {
      /** The path value. */
      path: appPath,
      /** The version value. */
      version: version || undefined,
    };
  } catch {
    return null;
  }
}

/** Finds the single app bundle. */
async function findSingleAppBundle(directory: string): Promise<string> {
  const entries = await fs.readdir(directory, { withFileTypes: true
  });
  const apps = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => path.join(directory, entry.name));
  if (apps.length !== 1) {
    throw new Error('The release must contain exactly one top-level app bundle.');
  }
  return apps[0];
}

/** Removes the quarantine. */
async function removeQuarantine(target: string, recursive: boolean): Promise<void> {
  try {
    await runExternalDownloaderCommand('/usr/bin/xattr', [
      recursive ? '-dr' : '-d', 'com.apple.quarantine', target,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/No such xattr|No such file/i.test(message)) throw error;
  }
}

/** Performs the sha256 operation. */
async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

/** Performs the require HTTPS URL operation. */
function requireHttpsUrl(value: string, label: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} URL is invalid.`);
  }
  if (url.protocol !== 'https:') throw new Error(`${label} URL must use HTTPS.`);
}

/** Performs the require release artifact URL operation. */
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

/** Determines whether the file condition applies. */
async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** Performs the path exists operation. */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
