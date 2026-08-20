import { app, dialog } from 'electron';
import {
  KAWAIKARA_MANIFEST_VERSION,
  KAWAIKARA_SITE_API_VERSION,
  defineBundle,
  definePlugin,
  defineProvider,
  type BundleBrowserProfileContribution,
  type BundleDefinition,
  type BundleLocaleContribution,
  type BundleManifest,
  type PluginConstructor,
  type PluginDefinition,
  type PluginManifest,
  type ProviderConstructor,
  type ProviderDefinition,
  type ProviderManifest,
  type SitePermission,
} from '@kawaikara/site-api';
import extractZip from 'extract-zip';
import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type {
  AppLocale,
  BundleInfo,
  BundleInstallResult,
} from '../../Common/IPC';
import { PluginHost } from '../Plugin/PluginHost';
import type { SiteManager } from './SiteManager';

const MANIFEST_NAME = 'manifest.json';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 96 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1_024;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ALLOWED_PERMISSIONS = new Set<SitePermission>([
  'navigation',
  'internal-view',
  'script-injection',
  'cookies',
  'network-interception',
  'external-browser',
]);

interface InspectedPlugin {
  readonly directoryPath: string;
  readonly manifest: PluginManifest;
}

interface InspectedProvider {
  readonly directoryPath: string;
  readonly manifest: ProviderManifest;
  readonly plugins: readonly InspectedPlugin[];
}

interface InspectedBundle {
  readonly manifest: BundleManifest;
  readonly providers: readonly [InspectedProvider, ...InspectedProvider[]];
  readonly plugins: readonly InspectedPlugin[];
  readonly permissions: readonly SitePermission[];
}

export class BundleManager {
  private readonly host: PluginHost;
  private readonly records = new Map<string, BundleInfo>();

  constructor(
    siteManager: SiteManager,
    private readonly bundleDirectoryPath: string,
  ) {
    this.host = new PluginHost(siteManager);
  }

  installBundled(bundle: BundleDefinition): void {
    this.host.install(bundle);
    this.records.set(bundle.id, createBundleInfo(bundle, 'built-in', 'active'));
  }

  async loadInstalled(): Promise<void> {
    await mkdir(this.bundleDirectoryPath, { recursive: true });
    const entries = await readdir(this.bundleDirectoryPath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      await this.loadInstalledDirectory(
        path.join(this.bundleDirectoryPath, entry.name),
        entry.name,
      );
    }
  }

  list(): BundleInfo[] {
    return [...this.records.values()].sort(
      (left, right) =>
        Number(left.source === 'user') - Number(right.source === 'user') ||
        left.name.localeCompare(right.name),
    );
  }

  async installFromDialog(locale: AppLocale): Promise<BundleInstallResult> {
    const selection = await dialog.showOpenDialog({
      title: getInstallCopy(locale).chooseTitle,
      properties: ['openFile'],
      filters: [{ name: 'Kawaikara Bundle', extensions: ['kawai'] }],
    });
    const archivePath = selection.filePaths[0];
    if (selection.canceled || !archivePath) return { status: 'cancelled' };
    if (path.extname(archivePath).toLowerCase() !== '.kawai') {
      throw new Error('Kawaikara Bundles must use the .kawai extension.');
    }

    const archiveStat = await stat(archivePath);
    if (!archiveStat.isFile() || archiveStat.size > MAX_ARCHIVE_BYTES) {
      throw new Error('The .kawai Bundle must be a file no larger than 32 MB.');
    }

    await mkdir(this.bundleDirectoryPath, { recursive: true });
    const stagingPath = path.join(
      this.bundleDirectoryPath,
      `.installing-${randomUUID()}`,
    );
    await mkdir(stagingPath, { recursive: false });

    try {
      await extractArchive(archivePath, stagingPath);
      const bundleRoot = await findBundleRoot(stagingPath);
      await validateExtractedTree(bundleRoot);
      const manifest = await readBundleManifest(bundleRoot);
      const inspected = await inspectBundle(bundleRoot, manifest);
      const destinationPath = path.join(this.bundleDirectoryPath, manifest.id);
      if (await pathExists(destinationPath)) {
        throw new Error(`Bundle ${manifest.id} is already installed.`);
      }
      if (this.records.has(manifest.id)) {
        throw new Error(`Bundle id ${manifest.id} is already registered.`);
      }

      const copy = getInstallCopy(locale);
      const confirmation = await dialog.showMessageBox({
        type: 'warning',
        title: copy.confirmTitle,
        message: copy.confirmMessage.replace('{name}', manifest.name),
        detail: [
          copy.confirmDetail,
          '',
          copy.permissionsHeading,
          ...(inspected.permissions.length
            ? inspected.permissions.map((permission) => `• ${permission}`)
            : [`• ${copy.noPermissions}`]),
        ].join('\n'),
        buttons: [copy.deny, copy.allowAndInstall],
        cancelId: 0,
        defaultId: 1,
        noLink: true,
      });
      if (confirmation.response !== 1) return { status: 'cancelled' };

      await rename(bundleRoot, destinationPath);
      const info = createInspectedInfo(inspected, 'restart-required');
      this.records.set(info.id, info);
      return { status: 'installed', bundle: info };
    } finally {
      await rm(stagingPath, { recursive: true, force: true });
    }
  }

  private async loadInstalledDirectory(
    rootPath: string,
    directoryName: string,
  ): Promise<void> {
    let manifest: BundleManifest | undefined;
    let inspected: InspectedBundle | undefined;
    try {
      await validateExtractedTree(rootPath);
      manifest = await readBundleManifest(rootPath);
      if (manifest.id !== directoryName) {
        throw new Error(
          `Bundle directory ${directoryName} does not match manifest id ${manifest.id}.`,
        );
      }
      inspected = await inspectBundle(rootPath, manifest);
      const bundle = loadBundleDefinition(inspected);
      this.host.install(bundle);
      this.records.set(
        manifest.id,
        createBundleInfo(bundle, 'user', 'active', inspected.permissions),
      );
    } catch (error) {
      const id = manifest?.id ?? directoryName;
      this.records.set(id, {
        id,
        name: manifest?.name ?? directoryName,
        description: manifest?.description,
        version: manifest?.version ?? '0.0.0',
        kind: manifest ? 'bundle' : 'unknown',
        source: 'user',
        status: 'failed',
        providerCount: inspected?.providers.length ?? 0,
        pluginCount: inspected
          ? inspected.plugins.length +
            inspected.providers.reduce(
              (total, provider) => total + provider.plugins.length,
              0,
            )
          : 0,
        permissions: inspected?.permissions ?? [],
        error: toErrorMessage(error),
      });
      console.error(`Failed to load installed Bundle ${id}.`, error);
    }
  }
}

async function extractArchive(
  archivePath: string,
  stagingPath: string,
): Promise<void> {
  let entryCount = 0;
  let extractedBytes = 0;
  await extractZip(archivePath, {
    dir: stagingPath,
    onEntry: (entry) => {
      validateArchiveEntryPath(entry.fileName);
      entryCount += 1;
      extractedBytes += entry.uncompressedSize;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        throw new Error('The .kawai Bundle contains too many files.');
      }
      if (extractedBytes > MAX_EXTRACTED_BYTES) {
        throw new Error('The extracted Bundle may not exceed 96 MB.');
      }
      const mode = (entry.externalFileAttributes >> 16) & 0xffff;
      if ((mode & 0o170000) === 0o120000) {
        throw new Error('.kawai Bundles may not contain symbolic links.');
      }
    },
  });
}

function validateArchiveEntryPath(value: string): void {
  if (
    !value ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`The .kawai Bundle contains an unsafe path: ${value}`);
  }
  const segments = value.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`The .kawai Bundle contains an unsafe path: ${value}`);
  }
}

async function findBundleRoot(stagingPath: string): Promise<string> {
  if (await pathExists(path.join(stagingPath, MANIFEST_NAME))) {
    return stagingPath;
  }
  const entries = (await readdir(stagingPath, { withFileTypes: true })).filter(
    (entry) => entry.name !== '__MACOSX',
  );
  if (entries.length !== 1 || !entries[0].isDirectory()) {
    throw new Error(
      'The .kawai Bundle must contain manifest.json at its root or in one top-level folder.',
    );
  }
  const nestedRoot = path.join(stagingPath, entries[0].name);
  if (!(await pathExists(path.join(nestedRoot, MANIFEST_NAME)))) {
    throw new Error('manifest.json is missing from the .kawai Bundle.');
  }
  return nestedRoot;
}

async function readBundleManifest(rootPath: string): Promise<BundleManifest> {
  const parsed = await readJson(path.join(rootPath, MANIFEST_NAME), 'Bundle');
  return validateBundleManifest(parsed);
}

async function inspectBundle(
  rootPath: string,
  manifest: BundleManifest,
): Promise<InspectedBundle> {
  const providers: InspectedProvider[] = [];
  const providerIds = new Set<string>();
  const pluginIds = new Set<string>();

  for (const relativeDirectory of manifest.providers) {
    const directoryPath = await resolveOwnedDirectory(rootPath, relativeDirectory);
    const providerManifest = validateProviderManifest(
      await readJson(path.join(directoryPath, MANIFEST_NAME), 'Provider'),
    );
    if (providerIds.has(providerManifest.id)) {
      throw new Error(`Duplicate Provider id ${providerManifest.id}.`);
    }
    providerIds.add(providerManifest.id);
    await resolveOwnedEntry(directoryPath, providerManifest.main, 'Provider main');
    const plugins: InspectedPlugin[] = [];
    for (const pluginDirectory of providerManifest.plugins ?? []) {
      const plugin = await inspectPlugin(directoryPath, pluginDirectory);
      if (pluginIds.has(plugin.manifest.id)) {
        throw new Error(`Duplicate Plugin id ${plugin.manifest.id}.`);
      }
      if (
        plugin.manifest.providerIds?.length &&
        !plugin.manifest.providerIds.includes(providerManifest.id)
      ) {
        throw new Error(
          `Provider-owned Plugin ${plugin.manifest.id} excludes ${providerManifest.id}.`,
        );
      }
      pluginIds.add(plugin.manifest.id);
      plugins.push(plugin);
    }
    providers.push({ directoryPath, manifest: providerManifest, plugins });
  }

  const plugins: InspectedPlugin[] = [];
  for (const relativeDirectory of manifest.plugins ?? []) {
    const plugin = await inspectPlugin(rootPath, relativeDirectory);
    if (pluginIds.has(plugin.manifest.id)) {
      throw new Error(`Duplicate Plugin id ${plugin.manifest.id}.`);
    }
    pluginIds.add(plugin.manifest.id);
    plugins.push(plugin);
  }

  const permissions = [...(manifest.permissions ?? [])];
  const grantedPermissions = new Set(permissions);
  for (const provider of providers) {
    for (const legacyPermission of provider.manifest.permissions ?? []) {
      if (!grantedPermissions.has(legacyPermission)) {
        throw new Error(
          `Provider ${provider.manifest.id} requests ${legacyPermission}, ` +
          'but the Bundle manifest does not grant it.',
        );
      }
    }
  }
  return {
    manifest,
    providers: providers as [InspectedProvider, ...InspectedProvider[]],
    plugins,
    permissions,
  };
}

async function inspectPlugin(
  ownerPath: string,
  relativeDirectory: string,
): Promise<InspectedPlugin> {
  const directoryPath = await resolveOwnedDirectory(ownerPath, relativeDirectory);
  const manifest = validatePluginManifest(
    await readJson(path.join(directoryPath, MANIFEST_NAME), 'Plugin'),
  );
  await resolveOwnedEntry(directoryPath, manifest.main, 'Plugin main');
  return { directoryPath, manifest };
}

function loadBundleDefinition(inspected: InspectedBundle): BundleDefinition {
  const providers = inspected.providers.map(loadProviderDefinition) as [
    ProviderDefinition,
    ...ProviderDefinition[],
  ];
  return defineBundle({
    id: inspected.manifest.id,
    name: inspected.manifest.name,
    description: inspected.manifest.description,
    version: inspected.manifest.version,
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    permissions: inspected.manifest.permissions ?? [],
    locale: inspected.manifest.locale,
    browserProfiles: inspected.manifest.browserProfiles,
    providers,
    plugins: inspected.plugins.map(loadPluginDefinition),
  });
}

function loadProviderDefinition(
  inspected: InspectedProvider,
): ProviderDefinition {
  const entryPath = path.resolve(inspected.directoryPath, inspected.manifest.main);
  const provider = loadConstructor<ProviderConstructor>(entryPath, 'provider');
  return defineProvider({
    manifest: inspected.manifest,
    provider,
    plugins: inspected.plugins.map(loadPluginDefinition),
  });
}

function loadPluginDefinition(inspected: InspectedPlugin): PluginDefinition {
  const entryPath = path.resolve(inspected.directoryPath, inspected.manifest.main);
  const plugin = loadConstructor<PluginConstructor>(entryPath, 'plugin');
  return definePlugin({ manifest: inspected.manifest, plugin });
}

function loadConstructor<T extends Function>(
  entryPath: string,
  namedExport: 'provider' | 'plugin',
): T {
  const externalRequire = createRequire(entryPath);
  const exported = externalRequire(entryPath) as unknown;
  if (typeof exported === 'function') return exported as T;
  if (!exported || typeof exported !== 'object') {
    throw new Error(`${namedExport} main must export a constructor.`);
  }
  const namespace = exported as Record<string, unknown>;
  const preferred = namespace.default ?? namespace[namedExport];
  if (typeof preferred === 'function') return preferred as T;
  const constructors = Object.values(namespace).filter(
    (value): value is Function => typeof value === 'function',
  );
  if (constructors.length !== 1) {
    throw new Error(
      `${namedExport} main must export one constructor as default or ${namedExport}.`,
    );
  }
  return constructors[0] as T;
}

function validateBundleManifest(value: unknown): BundleManifest {
  const candidate = requireObject(value, 'Bundle manifest');
  validateManifestHeader(candidate, 'Bundle');
  const providers = validatePathArray(candidate.providers, 'providers', false);
  const plugins = validatePathArray(candidate.plugins, 'plugins', true);
  const locale = validateLocale(candidate.locale);
  const browserProfiles = validateBrowserProfiles(candidate.browserProfiles);
  return Object.freeze({
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    id: requireId(candidate.id, 'Bundle id'),
    name: requireBoundedString(candidate.name, 'Bundle name', 100),
    description: optionalBoundedString(candidate.description, 'Bundle description', 500),
    version: requireVersion(candidate.version, 'Bundle version'),
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    permissions: validatePermissions(candidate.permissions),
    providers: providers as [string, ...string[]],
    plugins,
    locale,
    browserProfiles,
  });
}

function validateProviderManifest(value: unknown): ProviderManifest {
  const candidate = requireObject(value, 'Provider manifest');
  validateManifestHeader(candidate, 'Provider');
  return Object.freeze({
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    id: requireId(candidate.id, 'Provider id'),
    name: requireBoundedString(candidate.name, 'Provider name', 100),
    description: optionalBoundedString(
      candidate.description,
      'Provider description',
      500,
    ),
    version: requireVersion(candidate.version, 'Provider version'),
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    main: validateMain(candidate.main, 'Provider main'),
    permissions: validatePermissions(candidate.permissions),
    plugins: validatePathArray(candidate.plugins, 'Provider plugins', true),
  });
}

function validatePluginManifest(value: unknown): PluginManifest {
  const candidate = requireObject(value, 'Plugin manifest');
  validateManifestHeader(candidate, 'Plugin');
  return Object.freeze({
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    id: requireId(candidate.id, 'Plugin id'),
    name: requireBoundedString(candidate.name, 'Plugin name', 100),
    version: requireVersion(candidate.version, 'Plugin version'),
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    main: validateMain(candidate.main, 'Plugin main'),
    providerIds: validateIdArray(candidate.providerIds, 'Plugin providerIds'),
  });
}

function validateManifestHeader(
  candidate: Record<string, unknown>,
  kind: string,
): void {
  if (candidate.schemaVersion !== KAWAIKARA_MANIFEST_VERSION) {
    throw new Error(`${kind} manifest schemaVersion must be 1.`);
  }
  if (candidate.apiVersion !== KAWAIKARA_SITE_API_VERSION) {
    throw new Error(
      `${kind} requires Site API ${String(candidate.apiVersion)}; this app supports 1.`,
    );
  }
}

function validateMain(value: unknown, field: string): string {
  const main = requireSafeRelativePath(value, field);
  if (!/\.(?:cjs|js)$/i.test(main)) {
    throw new Error(`${field} must point to a CommonJS .cjs or .js file.`);
  }
  return main;
}

function validatePermissions(value: unknown): readonly SitePermission[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Provider permissions must be an array.');
  const permissions = value.map((permission) => {
    if (
      typeof permission !== 'string' ||
      !ALLOWED_PERMISSIONS.has(permission as SitePermission)
    ) {
      throw new Error(`Unknown Provider permission: ${String(permission)}`);
    }
    return permission as SitePermission;
  });
  return Object.freeze([...new Set(permissions)]);
}

function validatePathArray(
  value: unknown,
  field: string,
  optional: boolean,
): readonly string[] {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value) || (!optional && value.length === 0)) {
    throw new Error(`${field} must be ${optional ? 'an array' : 'a non-empty array'}.`);
  }
  const values = value.map((item) => requireSafeRelativePath(item, field));
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} contains duplicate directories.`);
  }
  return Object.freeze(values);
}

function validateIdArray(value: unknown, field: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  const values = value.map((item) => requireId(item, field));
  return Object.freeze([...new Set(values)]);
}

function validateLocale(value: unknown): BundleLocaleContribution | undefined {
  if (value === undefined) return undefined;
  const candidate = requireObject(value, 'Bundle locale');
  const supportedLocales = candidate.supportedLocales === undefined
    ? []
    : validateStringArray(candidate.supportedLocales, 'supportedLocales', 40);
  const defaultLocale = optionalBoundedString(
    candidate.defaultLocale,
    'defaultLocale',
    40,
  );
  return Object.freeze({ supportedLocales, defaultLocale });
}

function validateBrowserProfiles(
  value: unknown,
): readonly BundleBrowserProfileContribution[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('browserProfiles must be an array.');
  const ids = new Set<string>();
  return Object.freeze(value.map((item) => {
    const candidate = requireObject(item, 'Browser profile');
    const id = requireId(candidate.id, 'Browser profile id');
    if (ids.has(id)) throw new Error(`Duplicate browser profile id ${id}.`);
    ids.add(id);
    return Object.freeze({
      id,
      name: requireBoundedString(candidate.name, 'Browser profile name', 80),
      description: optionalBoundedString(
        candidate.description,
        'Browser profile description',
        300,
      ),
      persistent: candidate.persistent === undefined
        ? true
        : requireBoolean(candidate.persistent, 'Browser profile persistent'),
    });
  }));
}

function validateStringArray(
  value: unknown,
  field: string,
  maxLength: number,
): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return Object.freeze(
    value.map((item) => requireBoundedString(item, field, maxLength)),
  );
}

async function readJson(filePath: string, label: string): Promise<unknown> {
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${label} ${MANIFEST_NAME} is missing.`);
    }
    throw error;
  }
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new Error(`${label} ${MANIFEST_NAME} is not valid JSON.`);
  }
}

async function resolveOwnedDirectory(
  ownerPath: string,
  relativePath: string,
): Promise<string> {
  const resolvedOwner = await realpath(ownerPath);
  const candidate = path.resolve(resolvedOwner, relativePath);
  if (!isPathInside(resolvedOwner, candidate)) {
    throw new Error(`Directory ${relativePath} resolves outside its owner.`);
  }
  const resolved = await realpath(candidate);
  if (!isPathInside(resolvedOwner, resolved)) {
    throw new Error(`Directory ${relativePath} resolves outside its owner.`);
  }
  if (!(await lstat(resolved)).isDirectory()) {
    throw new Error(`${relativePath} is not a directory.`);
  }
  return resolved;
}

async function resolveOwnedEntry(
  ownerPath: string,
  relativePath: string,
  label: string,
): Promise<string> {
  const resolvedOwner = await realpath(ownerPath);
  const candidate = path.resolve(resolvedOwner, relativePath);
  if (!isPathInside(resolvedOwner, candidate)) {
    throw new Error(`${label} resolves outside its directory.`);
  }
  const resolved = await realpath(candidate);
  if (!isPathInside(resolvedOwner, resolved) || !(await lstat(resolved)).isFile()) {
    throw new Error(`${label} is not a regular file inside its directory.`);
  }
  return resolved;
}

async function validateExtractedTree(rootPath: string): Promise<void> {
  let entries = 0;
  let bytes = 0;
  const visit = async (directoryPath: string): Promise<void> => {
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
      const entryPath = path.join(directoryPath, entry.name);
      const entryStat = await lstat(entryPath);
      entries += 1;
      if (entries > MAX_ARCHIVE_ENTRIES) {
        throw new Error('The Bundle contains too many files.');
      }
      if (entryStat.isSymbolicLink()) {
        throw new Error('Bundles may not contain symbolic links.');
      }
      if (entryStat.isDirectory()) {
        await visit(entryPath);
      } else if (entryStat.isFile()) {
        bytes += entryStat.size;
        if (bytes > MAX_EXTRACTED_BYTES) {
          throw new Error('The installed Bundle may not exceed 96 MB.');
        }
      } else {
        throw new Error('Bundles may contain only regular files and folders.');
      }
    }
  };
  await visit(rootPath);
}

function createBundleInfo(
  bundle: BundleDefinition,
  source: BundleInfo['source'],
  status: BundleInfo['status'],
  permissions: readonly SitePermission[] = collectBundlePermissions(bundle),
): BundleInfo {
  return {
    id: bundle.id,
    name: bundle.name ?? bundle.id,
    description: bundle.description,
    version: bundle.version,
    kind: 'bundle',
    source,
    status,
    providerCount: bundle.providers.length,
    pluginCount:
      bundle.plugins.length +
      bundle.providers.reduce(
        (total, provider) => total + provider.plugins.length,
        0,
      ),
    permissions,
  };
}

function createInspectedInfo(
  bundle: InspectedBundle,
  status: BundleInfo['status'],
): BundleInfo {
  return {
    id: bundle.manifest.id,
    name: bundle.manifest.name,
    description: bundle.manifest.description,
    version: bundle.manifest.version,
    kind: 'bundle',
    source: 'user',
    status,
    providerCount: bundle.providers.length,
    pluginCount:
      bundle.plugins.length +
      bundle.providers.reduce(
        (total, provider) => total + provider.plugins.length,
        0,
      ),
    permissions: bundle.permissions,
  };
}

function collectBundlePermissions(bundle: BundleDefinition): readonly SitePermission[] {
  return [...bundle.permissions];
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown, field: string): string {
  const id = requireBoundedString(value, field, 128);
  if (!ID_PATTERN.test(id)) {
    throw new Error(`${field} ${id} contains unsupported characters.`);
  }
  return id;
}

function requireVersion(value: unknown, field: string): string {
  const version = requireBoundedString(value, field, 80);
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`${field} ${version} is not valid SemVer.`);
  }
  return version;
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} is empty or too long.`);
  }
  return normalized;
}

function optionalBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  return value === undefined
    ? undefined
    : requireBoundedString(value, field, maxLength);
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`);
  return value;
}

function requireSafeRelativePath(value: unknown, field: string): string {
  const normalized = requireBoundedString(value, field, 300);
  const segments = normalized.split('/');
  if (
    normalized.includes('\\') ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === '..' || segment === '.')
  ) {
    throw new Error(`${field} must be a safe relative path.`);
  }
  return normalized;
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getInstallCopy(locale: AppLocale): {
  readonly chooseTitle: string;
  readonly confirmTitle: string;
  readonly confirmMessage: string;
  readonly confirmDetail: string;
  readonly permissionsHeading: string;
  readonly noPermissions: string;
  readonly deny: string;
  readonly allowAndInstall: string;
} {
  const language = locale === 'system' ? app.getLocale() : locale;
  if (language.toLowerCase().startsWith('ko')) {
    return {
      chooseTitle: 'Kawaikara Bundle 선택',
      confirmTitle: 'Bundle 설치',
      confirmMessage: '“{name}” Bundle을 설치할까요?',
      confirmDetail:
        '.kawai는 ZIP 컨테이너이며 Main 프로세스에서 실행되는 코드를 포함할 수 있습니다. 아래 권한을 검토하세요. 설치 후 앱을 다시 시작해야 합니다.',
      permissionsHeading: '요청하는 권한',
      noPermissions: '추가 Provider 권한 없음',
      deny: '허가하지 않음',
      allowAndInstall: '허가 및 설치',
    };
  }
  if (language.toLowerCase().startsWith('ja')) {
    return {
      chooseTitle: 'Kawaikara Bundleを選択',
      confirmTitle: 'Bundleをインストール',
      confirmMessage: '「{name}」Bundleをインストールしますか？',
      confirmDetail:
        '.kawaiはZIPコンテナで、Mainプロセスで実行されるコードを含む場合があります。以下の権限を確認してください。再起動後に有効になります。',
      permissionsHeading: '要求する権限',
      noPermissions: '追加のProvider権限なし',
      deny: '許可しない',
      allowAndInstall: '許可してインストール',
    };
  }
  return {
    chooseTitle: 'Choose a Kawaikara Bundle',
    confirmTitle: 'Install Bundle',
    confirmMessage: 'Install the “{name}” Bundle?',
    confirmDetail:
      '.kawai is a ZIP container and can include code that runs in the Main process. Review the permissions below. Restart Kawaikara to activate it.',
    permissionsHeading: 'Requested permissions',
    noPermissions: 'No additional Provider permissions',
    deny: 'Deny',
    allowAndInstall: 'Allow and install',
  };
}
