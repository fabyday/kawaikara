import { app, dialog, net } from 'electron';
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
  type BundleUpdateDefinition,
  type BundleUpdateManifest,
  type BundleUpdateResolver,
  type PluginConstructor,
  type PluginDefinition,
  type PluginManifest,
  type ProviderConstructor,
  type ProviderDefinition,
  type ProviderManifest,
  type ProviderManifestContributions,
  type SitePermission,
} from '@kawaikara/site-api';
import * as SiteApi from '@kawaikara/site-api';
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
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type {
  AppLocale,
  BundleInfo,
  BundleInstallResult,
  BundleRemoveResult,
  BundleUpdateResult,
} from '../../Common/IPC';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';
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
  'plugin-view',
  'script-injection',
  'cookies',
  'network-interception',
  'external-browser',
]);
const SITE_API_BRIDGE_KEY = '__kawaikaraSiteApiV1';

const existingSiteApiBridge = Reflect.get(globalThis, SITE_API_BRIDGE_KEY);
if (existingSiteApiBridge === undefined) {
  Object.defineProperty(globalThis, SITE_API_BRIDGE_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: SiteApi,
  });
} else if (existingSiteApiBridge !== SiteApi) {
  throw new Error('A conflicting Kawaikara Site API bridge is already installed.');
}

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
  readonly rootPath: string;
  readonly manifest: BundleManifest;
  readonly providers: readonly [InspectedProvider, ...InspectedProvider[]];
  readonly plugins: readonly InspectedPlugin[];
  readonly permissions: readonly SitePermission[];
}

export class BundleManager {
  private readonly host: PluginHost;
  private readonly records = new Map<string, BundleInfo>();
  private readonly bundledDefinitions = new Map<string, BundleDefinition>();
  private readonly activatedBundleIds = new Set<string>();
  private readonly updateDefinitions = new Map<string, BundleUpdateDefinition>();

  constructor(
    siteManager: SiteManager,
    private readonly bundleDirectoryPath: string,
  ) {
    this.host = new PluginHost(siteManager);
  }

  installBundled(bundle: BundleDefinition): void {
    if (this.bundledDefinitions.has(bundle.id)) {
      throw new Error(`Built-in Bundle ${bundle.id} is already registered.`);
    }
    this.bundledDefinitions.set(bundle.id, bundle);
    this.setUpdateDefinition(bundle.id, getBundleUpdateDefinition(bundle));
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
    for (const bundle of this.bundledDefinitions.values()) {
      if (this.activatedBundleIds.has(bundle.id)) continue;
      this.host.install(bundle);
      this.activatedBundleIds.add(bundle.id);
      this.setUpdateDefinition(bundle.id, getBundleUpdateDefinition(bundle));
      this.records.set(bundle.id, createBundleInfo(bundle, 'built-in', 'active'));
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
      let updateDefinition: BundleUpdateDefinition | undefined;
      try {
        await ensureSiteApiBridge(destinationPath);
        // Resolver modules are trusted Main code. Load them only after the
        // install consent dialog has been accepted and the Bundle is in place.
        updateDefinition = loadBundleUpdateDefinition(destinationPath, manifest);
      } catch (error) {
        await rm(destinationPath, { recursive: true, force: true });
        throw error;
      }
      const info = createInspectedInfo(inspected, 'restart-required', 'user');
      this.setUpdateDefinition(manifest.id, updateDefinition);
      this.records.set(info.id, info);
      return { status: 'installed', bundle: info };
    } finally {
      await rm(stagingPath, { recursive: true, force: true });
    }
  }

  async update(id: string, locale: AppLocale): Promise<BundleUpdateResult> {
    const current = this.requireBundle(id);
    const updateDefinition = this.updateDefinitions.get(id);
    if (!updateDefinition) {
      throw new Error(`Bundle ${id} does not provide update metadata.`);
    }
    const copy = getBundleActionCopy(locale);
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: copy.updateTitle,
      message: copy.updateMessage.replace('{name}', current.name),
      detail: copy.restartDetail,
      buttons: [copy.cancel, copy.update],
      cancelId: 0,
      defaultId: 1,
      noLink: true,
    });
    if (confirmation.response !== 1) return { status: 'cancelled' };

    await mkdir(this.bundleDirectoryPath, { recursive: true });
    const token = randomUUID();
    const archivePath = path.join(this.bundleDirectoryPath, `.update-${token}.kawai`);
    const stagingPath = path.join(this.bundleDirectoryPath, `.updating-${token}`);
    const destinationPath = path.join(this.bundleDirectoryPath, id);
    const backupPath = path.join(this.bundleDirectoryPath, `.backup-${id}-${token}`);
    await mkdir(stagingPath, { recursive: false });
    let backedUp = false;
    try {
      const updateUrl = await resolveBundleUpdateUrl(updateDefinition, current.version);
      await downloadBundleArchive(updateUrl, archivePath);
      await extractArchive(archivePath, stagingPath);
      const bundleRoot = await findBundleRoot(stagingPath);
      await validateExtractedTree(bundleRoot);
      const manifest = await readBundleManifest(bundleRoot);
      if (manifest.id !== id) {
        throw new Error(`Update Bundle id ${manifest.id} does not match ${id}.`);
      }
      if (compareSemVer(manifest.version, current.version) < 0) {
        throw new Error(
          `Update Bundle ${manifest.version} is older than installed version ` +
          `${current.version}.`,
        );
      }
      const inspected = await inspectBundle(bundleRoot, manifest);
      const hadInstalledOverride = await pathExists(destinationPath);
      if (hadInstalledOverride) {
        await rename(destinationPath, backupPath);
        backedUp = true;
      }
      try {
        await rename(bundleRoot, destinationPath);
        await ensureSiteApiBridge(destinationPath);
        const nextUpdateDefinition = loadBundleUpdateDefinition(
          destinationPath,
          manifest,
        );
        this.setUpdateDefinition(id, nextUpdateDefinition);
      } catch (error) {
        if (await pathExists(destinationPath)) {
          await rm(destinationPath, { recursive: true, force: true });
        }
        if (backedUp) {
          await rename(backupPath, destinationPath);
          backedUp = false;
        }
        throw error;
      }
      const info = createInspectedInfo(
        inspected,
        'restart-required',
        current.source,
      );
      this.records.set(id, info);
      return { status: 'updated', bundle: info };
    } finally {
      await rm(archivePath, { force: true });
      await rm(stagingPath, { recursive: true, force: true });
      if (backedUp) await rm(backupPath, { recursive: true, force: true });
    }
  }

  async remove(id: string, locale: AppLocale): Promise<BundleRemoveResult> {
    const bundle = this.requireUserBundle(id);
    const copy = getBundleActionCopy(locale);
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: copy.removeTitle,
      message: copy.removeMessage.replace('{name}', bundle.name),
      detail: copy.restartDetail,
      buttons: [copy.cancel, copy.remove],
      cancelId: 0,
      defaultId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return { status: 'cancelled' };
    await rm(path.join(this.bundleDirectoryPath, id), {
      recursive: true,
      force: false,
    });
    this.records.delete(id);
    this.updateDefinitions.delete(id);
    return { status: 'removed', bundleId: id };
  }

  private requireUserBundle(id: string): BundleInfo {
    const bundle = this.requireBundle(id);
    if (!bundle || bundle.source !== 'user') {
      throw new Error(`User Bundle ${id} is not installed.`);
    }
    return bundle;
  }

  private requireBundle(id: string): BundleInfo {
    const bundle = this.records.get(id);
    if (!bundle) throw new Error(`Bundle ${id} is not installed.`);
    return bundle;
  }

  private setUpdateDefinition(
    id: string,
    definition: BundleUpdateDefinition | undefined,
  ): void {
    if (definition) this.updateDefinitions.set(id, definition);
    else this.updateDefinitions.delete(id);
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
      const embeddedBundle = this.bundledDefinitions.get(manifest.id);
      if (
        embeddedBundle &&
        compareSemVer(manifest.version, embeddedBundle.version) < 0
      ) {
        console.warn(
          `Ignoring older on-disk built-in Bundle ${manifest.id} ` +
          `(${manifest.version} < ${embeddedBundle.version}).`,
        );
        return;
      }
      inspected = await inspectBundle(rootPath, manifest);
      await ensureSiteApiBridge(rootPath);
      const bundle = loadBundleDefinition(inspected);
      this.host.install(bundle);
      this.activatedBundleIds.add(manifest.id);
      const source = this.bundledDefinitions.has(manifest.id)
        ? 'built-in'
        : 'user';
      this.setUpdateDefinition(manifest.id, getBundleUpdateDefinition(bundle));
      this.records.set(
        manifest.id,
        createBundleInfo(bundle, source, 'active', inspected.permissions),
      );
    } catch (error) {
      const id = manifest?.id ?? directoryName;
      const source = this.bundledDefinitions.has(id) ? 'built-in' : 'user';
      let updateDefinition: BundleUpdateDefinition | undefined;
      if (manifest) {
        try {
          updateDefinition = loadBundleUpdateDefinition(rootPath, manifest);
        } catch {
          // The primary load error below is more useful. A broken resolver
          // cannot be used to repair this Bundle from the UI.
        }
      }
      this.setUpdateDefinition(id, updateDefinition);
      this.records.set(id, {
        id,
        name: manifest?.name ?? directoryName,
        description: manifest?.description,
        version: manifest?.version ?? '0.0.0',
        kind: manifest ? 'bundle' : 'unknown',
        source,
        status: 'failed',
        updatable: Boolean(updateDefinition),
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
  if (manifest.update?.type === 'resolver') {
    await resolveOwnedEntry(rootPath, manifest.update.main, 'Bundle update resolver');
  }
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
    for (const permission of provider.manifest.permissions ?? []) {
      if (!grantedPermissions.has(permission)) {
        throw new Error(
          `Provider ${provider.manifest.id} requests ${permission}, ` +
          'but the Bundle manifest does not grant it.',
        );
      }
    }
  }
  return {
    rootPath,
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
    update: loadBundleUpdateDefinition(
      inspected.rootPath,
      inspected.manifest,
    ),
    updateUrl: inspected.manifest.updateUrl,
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    permissions: inspected.manifest.permissions ?? [],
    locale: inspected.manifest.locale,
    browserProfiles: inspected.manifest.browserProfiles,
    providers,
    plugins: inspected.plugins.map(loadPluginDefinition),
  });
}

function loadBundleUpdateDefinition(
  rootPath: string,
  manifest: BundleManifest,
): BundleUpdateDefinition | undefined {
  if (manifest.update?.type === 'archive') {
    return Object.freeze({ type: 'archive', url: manifest.update.url });
  }
  if (manifest.update?.type === 'resolver') {
    return Object.freeze({
      type: 'resolver',
      resolve: loadUpdateResolver(path.resolve(rootPath, manifest.update.main)),
    });
  }
  return manifest.updateUrl
    ? Object.freeze({ type: 'archive', url: manifest.updateUrl })
    : undefined;
}

function getBundleUpdateDefinition(
  bundle: BundleDefinition,
): BundleUpdateDefinition | undefined {
  return bundle.update ?? (bundle.updateUrl
    ? Object.freeze({ type: 'archive', url: bundle.updateUrl })
    : undefined);
}

function loadUpdateResolver(entryPath: string): BundleUpdateResolver {
  const externalRequire = createRequire(entryPath);
  const exported = externalRequire(entryPath) as unknown;
  if (typeof exported === 'function') return exported as BundleUpdateResolver;
  if (!exported || typeof exported !== 'object') {
    throw new Error('Bundle update resolver must export a function.');
  }
  const namespace = exported as Record<string, unknown>;
  const preferred =
    namespace.default ?? namespace.resolveBundleUpdate ?? namespace.resolveUpdate;
  if (typeof preferred !== 'function') {
    throw new Error(
      'Bundle update resolver must export default, resolveBundleUpdate, or resolveUpdate.',
    );
  }
  return preferred as BundleUpdateResolver;
}

async function resolveBundleUpdateUrl(
  definition: BundleUpdateDefinition,
  currentVersion: string,
): Promise<string> {
  const value = definition.type === 'archive'
    ? definition.url
    : await definition.resolve({
        currentVersion,
        channel: BUILD_CHANNEL,
        platform: process.platform,
        arch: process.arch,
      });
  return validateUpdateUrl(value, 'Bundle update URL')!;
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
  if (candidate.update !== undefined && candidate.updateUrl !== undefined) {
    throw new Error('Bundle manifest must use either update or updateUrl, not both.');
  }
  const update = validateBundleUpdateManifest(candidate.update);
  return Object.freeze({
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    id: requireId(candidate.id, 'Bundle id'),
    name: requireBoundedString(candidate.name, 'Bundle name', 100),
    description: optionalBoundedString(candidate.description, 'Bundle description', 500),
    version: requireVersion(candidate.version, 'Bundle version'),
    update,
    updateUrl: validateUpdateUrl(candidate.updateUrl, 'Bundle updateUrl'),
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    permissions: validatePermissions(candidate.permissions, true),
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
    contributes: validateProviderManifestContributions(candidate.contributes),
    plugins: validatePathArray(candidate.plugins, 'Provider plugins', true),
  });
}

function validateProviderManifestContributions(
  value: unknown,
): ProviderManifestContributions {
  const candidate = requireObject(value, 'Provider contributes');
  for (const forbidden of ['id', 'title', 'description', 'permissions']) {
    if (candidate[forbidden] !== undefined) {
      throw new Error(
        `Provider contributes must not contain ${forbidden}; use the manifest field.`,
      );
    }
  }
  const allowed = new Set([
    'address',
    'menu',
    'shortcut',
    'settings',
    'shortFormVideo',
    'locale',
    'isolation',
    'pictureInPicture',
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) {
      throw new Error(`Provider contributes contains unknown field ${key}.`);
    }
  }
  if (candidate.menu === undefined) {
    throw new Error('Provider contributes must contain menu metadata.');
  }
  return Object.freeze({ ...candidate }) as ProviderManifestContributions;
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

function validateBundleUpdateManifest(
  value: unknown,
): BundleUpdateManifest | undefined {
  if (value === undefined) return undefined;
  const candidate = requireObject(value, 'Bundle update');
  if (candidate.type === 'archive') {
    return Object.freeze({
      type: 'archive',
      url: validateUpdateUrl(candidate.url, 'Bundle update URL')!,
    });
  }
  if (candidate.type === 'resolver') {
    return Object.freeze({
      type: 'resolver',
      main: validateMain(candidate.main, 'Bundle update resolver main'),
    });
  }
  throw new Error('Bundle update type must be archive or resolver.');
}

function validateUpdateUrl(
  value: unknown,
  field = 'Bundle update URL',
): string | undefined {
  if (value === undefined) return undefined;
  const raw = requireBoundedString(value, field, 2_048);
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error(`${field} must be a credential-free HTTPS URL.`);
  }
  return url.href;
}

function validatePermissions(
  value: unknown,
  required = false,
): readonly SitePermission[] {
  if (value === undefined) {
    if (required) throw new Error('Provider permissions must be declared.');
    return [];
  }
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

async function ensureSiteApiBridge(rootPath: string): Promise<void> {
  const bridgePath = path.join(
    rootPath,
    'node_modules',
    '@kawaikara',
    'site-api',
  );
  await rm(bridgePath, { recursive: true, force: true });
  await mkdir(bridgePath, { recursive: true });
  await writeFile(
    path.join(bridgePath, 'package.json'),
    `${JSON.stringify({
      name: '@kawaikara/site-api',
      version: `${String(KAWAIKARA_SITE_API_VERSION)}.0.0`,
      private: true,
      main: 'index.cjs',
    }, null, 2)}\n`,
    { flag: 'wx' },
  );
  await writeFile(
    path.join(bridgePath, 'index.cjs'),
    [
      `'use strict';`,
      `const api = globalThis[${JSON.stringify(SITE_API_BRIDGE_KEY)}];`,
      `if (!api) throw new Error('Kawaikara Site API bridge is unavailable.');`,
      'module.exports = api;',
      '',
    ].join('\n'),
    { flag: 'wx' },
  );
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
    updatable: Boolean(bundle.update ?? bundle.updateUrl),
    updateUrl: bundle.updateUrl,
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
  source: BundleInfo['source'],
): BundleInfo {
  return {
    id: bundle.manifest.id,
    name: bundle.manifest.name,
    description: bundle.manifest.description,
    version: bundle.manifest.version,
    updatable: Boolean(bundle.manifest.update ?? bundle.manifest.updateUrl),
    updateUrl: bundle.manifest.updateUrl,
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

function compareSemVer(left: string, right: string): number {
  const parse = (value: string): {
    readonly core: readonly number[];
    readonly prerelease: readonly string[];
  } => {
    const [withoutBuild] = value.split('+', 1);
    const separator = withoutBuild.indexOf('-');
    const core = (separator < 0 ? withoutBuild : withoutBuild.slice(0, separator))
      .split('.')
      .map(Number);
    const prerelease = separator < 0
      ? []
      : withoutBuild.slice(separator + 1).split('.');
    return { core, prerelease };
  };
  const leftVersion = parse(left);
  const rightVersion = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftVersion.core[index] - rightVersion.core[index];
    if (difference) return Math.sign(difference);
  }
  if (!leftVersion.prerelease.length || !rightVersion.prerelease.length) {
    return Number(!leftVersion.prerelease.length) -
      Number(!rightVersion.prerelease.length);
  }
  const length = Math.max(
    leftVersion.prerelease.length,
    rightVersion.prerelease.length,
  );
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Math.sign(Number(leftPart) - Number(rightPart));
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
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

async function downloadBundleArchive(url: string, destinationPath: string): Promise<void> {
  const response = await net.fetch(validateUpdateUrl(url)!, { redirect: 'follow' });
  const finalUrl = validateUpdateUrl(response.url);
  if (!finalUrl || !response.ok) {
    throw new Error(`Bundle update download failed with HTTP ${String(response.status)}.`);
  }
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_ARCHIVE_BYTES) {
    throw new Error('The Bundle update archive may not exceed 32 MB.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('The Bundle update archive may not exceed 32 MB.');
  }
  await writeFile(destinationPath, bytes, { flag: 'wx' });
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

function getBundleActionCopy(locale: AppLocale): {
  readonly updateTitle: string;
  readonly updateMessage: string;
  readonly removeTitle: string;
  readonly removeMessage: string;
  readonly restartDetail: string;
  readonly cancel: string;
  readonly update: string;
  readonly remove: string;
} {
  const language = locale === 'system' ? app.getLocale() : locale;
  if (language.toLowerCase().startsWith('ko')) {
    return {
      updateTitle: 'Bundle 업데이트',
      updateMessage: '“{name}” Bundle을 업데이트할까요?',
      removeTitle: 'Bundle 삭제',
      removeMessage: '“{name}” Bundle을 삭제할까요?',
      restartDetail: '실행 중인 코드는 Kawaikara를 다시 시작한 뒤 변경됩니다.',
      cancel: '취소',
      update: '업데이트',
      remove: '삭제',
    };
  }
  if (language.toLowerCase().startsWith('ja')) {
    return {
      updateTitle: 'Bundleを更新',
      updateMessage: '「{name}」Bundleを更新しますか？',
      removeTitle: 'Bundleを削除',
      removeMessage: '「{name}」Bundleを削除しますか？',
      restartDetail: '実行中のコードへの変更はKawaikaraの再起動後に反映されます。',
      cancel: 'キャンセル',
      update: '更新',
      remove: '削除',
    };
  }
  return {
    updateTitle: 'Update Bundle',
    updateMessage: 'Update the “{name}” Bundle?',
    removeTitle: 'Remove Bundle',
    removeMessage: 'Remove the “{name}” Bundle?',
    restartDetail: 'Changes to running code take effect after restarting Kawaikara.',
    cancel: 'Cancel',
    update: 'Update',
    remove: 'Remove',
  };
}
