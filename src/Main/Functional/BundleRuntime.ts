import { app, net } from 'electron';
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
  type ProviderLocaleResource,
  type SitePermission,
} from '@kawaikara/site-api';
import * as SiteApi from '@kawaikara/site-api';
import extractZip from 'extract-zip';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { AppLocale, BundleInfo } from '../../Common/IPC';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';
import {
  optionalBoundedString,
  requireBoundedString,
  requireJsonObject as requireObject,
  requireSafeRelativePath,
  validateProviderLocaleContribution,
  validateProviderLocaleResource,
  validateStringArray,
} from './BundleValidation';

/** Defines the shared manifest name constant. */
const MANIFEST_NAME = 'manifest.json';
/** Defines the shared max archive bytes constant. */
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
/** Defines the shared max extracted bytes constant. */
const MAX_EXTRACTED_BYTES = 96 * 1024 * 1024;
/** Defines the shared max archive entries constant. */
const MAX_ARCHIVE_ENTRIES = 1_024;
/** Defines the shared ID pattern constant. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** Defines the shared version pattern constant. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Defines the shared allowed permissions constant. */
const ALLOWED_PERMISSIONS = new Set<SitePermission>([
  'navigation',
  'internal-view',
  'plugin-view',
  'script-injection',
  'cookies',
  'network-interception',
  'external-browser',
]);
/** Defines the shared site API bridge key constant. */
const SITE_API_BRIDGE_KEY = '__kawaikaraSiteApiV1';

/** Stores the existing site API bridge value. */
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

/** Describes the inspected plugin contract. */
export interface InspectedPlugin {
  /** The directory path value. */
  readonly directoryPath: string;
  /** The manifest value. */
  readonly manifest: PluginManifest;
}

/** Describes the inspected provider contract. */
export interface InspectedProvider {
  /** The directory path value. */
  readonly directoryPath: string;
  /** The manifest value. */
  readonly manifest: ProviderManifest;
  /** The localization value. */
  readonly localization?: ProviderLocaleResource;
  /** The plugins value. */
  readonly plugins: readonly InspectedPlugin[];
}

/** Describes the inspected bundle contract. */
export interface InspectedBundle {
  /** The root path value. */
  readonly rootPath: string;
  /** The manifest value. */
  readonly manifest: BundleManifest;
  /** The providers value. */
  readonly providers: readonly [InspectedProvider, ...InspectedProvider[]];
  /** The plugins value. */
  readonly plugins: readonly InspectedPlugin[];
  /** The permissions value. */
  readonly permissions: readonly SitePermission[];
}

/** Performs the extract archive operation. */
export async function extractArchive(
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

/** Validates the archive entry path. */
export function validateArchiveEntryPath(value: string): void {
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

/** Finds the bundle root. */
export async function findBundleRoot(stagingPath: string): Promise<string> {
  if (await pathExists(path.join(stagingPath, MANIFEST_NAME))) {
    return stagingPath;
  }
  const entries = (await readdir(stagingPath, { withFileTypes: true
  })).filter(
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

/** Reads the bundle manifest. */
export async function readBundleManifest(rootPath: string): Promise<BundleManifest> {
  const parsed = await readJson(path.join(rootPath, MANIFEST_NAME), 'Bundle');
  return validateBundleManifest(parsed);
}

/** Performs the inspect bundle operation. */
export async function inspectBundle(
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
    const localeResource = providerManifest.contributes.locale?.resource;
    const localization = localeResource
      ? validateProviderLocaleResource(await readJson(
          await resolveOwnedEntry(
            directoryPath,
            localeResource,
            'Provider locale resource',
          ),
          'Provider locale resource',
        ))
      : undefined;
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
    providers.push({
      directoryPath,
      manifest: providerManifest,
      localization,
      plugins,
    });
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
    /** The root path value. */
    rootPath,
    /** The manifest value. */
    manifest,
    /** The providers value. */
    providers: providers as [InspectedProvider, ...InspectedProvider[]],
    /** The plugins value. */
    plugins,
    /** The permissions value. */
    permissions,
  };
}

/** Performs the inspect plugin operation. */
export async function inspectPlugin(
  ownerPath: string,
  relativeDirectory: string,
): Promise<InspectedPlugin> {
  const directoryPath = await resolveOwnedDirectory(ownerPath, relativeDirectory);
  const manifest = validatePluginManifest(
    await readJson(path.join(directoryPath, MANIFEST_NAME), 'Plugin'),
  );
  await resolveOwnedEntry(directoryPath, manifest.main, 'Plugin main');
  return {
    /** The directory path value. */
    directoryPath,
    /** The manifest value. */
    manifest,
  };
}

/** Loads the bundle definition. */
export function loadBundleDefinition(inspected: InspectedBundle): BundleDefinition {
  const providers = inspected.providers.map(loadProviderDefinition) as [
    ProviderDefinition,
    ...ProviderDefinition[],
  ];
  return defineBundle({
    /** The ID value. */
    id: inspected.manifest.id,
    /** The name value. */
    name: inspected.manifest.name,
    /** The description value. */
    description: inspected.manifest.description,
    /** The version value. */
    version: inspected.manifest.version,
    /** The update value. */
    update: loadBundleUpdateDefinition(
      inspected.rootPath,
      inspected.manifest,
    ),
    /** The update URL value. */
    updateUrl: inspected.manifest.updateUrl,
    /** The API version value. */
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    /** The permissions value. */
    permissions: inspected.manifest.permissions ?? [],
    /** The locale value. */
    locale: inspected.manifest.locale,
    /** The browser profiles value. */
    browserProfiles: inspected.manifest.browserProfiles,
    /** The providers value. */
    providers,
    /** The plugins value. */
    plugins: inspected.plugins.map(loadPluginDefinition),
  });
}

/** Loads the bundle update definition. */
export function loadBundleUpdateDefinition(
  rootPath: string,
  manifest: BundleManifest,
): BundleUpdateDefinition | undefined {
  if (manifest.update?.type === 'archive') {
    return Object.freeze({
      /** The type value. */
      type: 'archive',
      /** The URL value. */
      url: manifest.update.url,
    });
  }
  if (manifest.update?.type === 'resolver') {
    return Object.freeze({
      /** The type value. */
      type: 'resolver',
      /** The resolve value. */
      resolve: loadUpdateResolver(path.resolve(rootPath, manifest.update.main)),
    });
  }
  return manifest.updateUrl
    ? Object.freeze({
      /** The type value. */
      type: 'archive',
      /** The URL value. */
      url: manifest.updateUrl,
    })
    : undefined;
}

/** Returns the bundle update definition. */
export function getBundleUpdateDefinition(
  bundle: BundleDefinition,
): BundleUpdateDefinition | undefined {
  return bundle.update ?? (bundle.updateUrl
    ? Object.freeze({ type: 'archive', url: bundle.updateUrl
    })
    : undefined);
}

/** Loads the update resolver. */
export function loadUpdateResolver(entryPath: string): BundleUpdateResolver {
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

/** Resolves the bundle update URL. */
export async function resolveBundleUpdateUrl(
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

/** Loads the provider definition. */
export function loadProviderDefinition(
  inspected: InspectedProvider,
): ProviderDefinition {
  const entryPath = path.resolve(inspected.directoryPath, inspected.manifest.main);
  const provider = loadConstructor<ProviderConstructor>(entryPath, 'provider');
  return defineProvider({
    /** The manifest value. */
    manifest: inspected.manifest,
    /** The provider value. */
    provider,
    /** The localization value. */
    localization: inspected.localization,
    /** The plugins value. */
    plugins: inspected.plugins.map(loadPluginDefinition),
  });
}

/** Loads the plugin definition. */
export function loadPluginDefinition(inspected: InspectedPlugin): PluginDefinition {
  const entryPath = path.resolve(inspected.directoryPath, inspected.manifest.main);
  const plugin = loadConstructor<PluginConstructor>(entryPath, 'plugin');
  return definePlugin({
    /** The manifest value. */
    manifest: inspected.manifest,
    /** The plugin value. */
    plugin,
  });
}

/** Loads the function Object() { [native code] }. */
export function loadConstructor<T extends Function>(
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

/** Validates the bundle manifest. */
export function validateBundleManifest(value: unknown): BundleManifest {
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
    /** The schema version value. */
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    /** The ID value. */
    id: requireId(candidate.id, 'Bundle id'),
    /** The name value. */
    name: requireBoundedString(candidate.name, 'Bundle name', 100),
    /** The description value. */
    description: optionalBoundedString(candidate.description, 'Bundle description', 500),
    /** The version value. */
    version: requireVersion(candidate.version, 'Bundle version'),
    /** The update value. */
    update,
    /** The update URL value. */
    updateUrl: validateUpdateUrl(candidate.updateUrl, 'Bundle updateUrl'),
    /** The API version value. */
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    /** The permissions value. */
    permissions: validatePermissions(candidate.permissions, true),
    /** The providers value. */
    providers: providers as [string, ...string[]],
    /** The plugins value. */
    plugins,
    /** The locale value. */
    locale,
    /** The browser profiles value. */
    browserProfiles,
  });
}

/** Validates the provider manifest. */
export function validateProviderManifest(value: unknown): ProviderManifest {
  const candidate = requireObject(value, 'Provider manifest');
  validateManifestHeader(candidate, 'Provider');
  return Object.freeze({
    /** The schema version value. */
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    /** The ID value. */
    id: requireId(candidate.id, 'Provider id'),
    /** The name value. */
    name: requireBoundedString(candidate.name, 'Provider name', 100),
    /** The description value. */
    description: optionalBoundedString(
      candidate.description,
      'Provider description',
      500,
    ),
    /** The version value. */
    version: requireVersion(candidate.version, 'Provider version'),
    /** The API version value. */
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    /** The main value. */
    main: validateMain(candidate.main, 'Provider main'),
    /** The permissions value. */
    permissions: validatePermissions(candidate.permissions),
    /** The contributes value. */
    contributes: validateProviderManifestContributions(candidate.contributes),
    /** The plugins value. */
    plugins: validatePathArray(candidate.plugins, 'Provider plugins', true),
  });
}

/** Validates the provider manifest contributions. */
export function validateProviderManifestContributions(
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
    'shortFormVideo',
    'locale',
    'isolation',
    'pictureInPicture',
    'browserIdentity',
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) {
      throw new Error(`Provider contributes contains unknown field ${key}.`);
    }
  }
  if (candidate.menu === undefined) {
    throw new Error('Provider contributes must contain menu metadata.');
  }
  if (
    candidate.pictureInPicture !== undefined &&
    (!candidate.pictureInPicture ||
      typeof candidate.pictureInPicture !== 'object' ||
      Array.isArray(candidate.pictureInPicture) ||
      Object.keys(candidate.pictureInPicture).some((key) => key !== 'enabled') ||
      ((candidate.pictureInPicture as Record<string, unknown>).enabled !== undefined &&
        typeof (candidate.pictureInPicture as Record<string, unknown>).enabled !== 'boolean'))
  ) {
    throw new Error(
      'Provider manifest pictureInPicture may only declare enabled; ' +
      'put selectors and page policy in @provider().',
    );
  }
  return Object.freeze({
    ...candidate,
    /** The locale value. */
    locale: validateProviderLocaleContribution(candidate.locale),
  }) as ProviderManifestContributions;
}

/** Validates the plugin manifest. */
export function validatePluginManifest(value: unknown): PluginManifest {
  const candidate = requireObject(value, 'Plugin manifest');
  validateManifestHeader(candidate, 'Plugin');
  return Object.freeze({
    /** The schema version value. */
    schemaVersion: KAWAIKARA_MANIFEST_VERSION,
    /** The ID value. */
    id: requireId(candidate.id, 'Plugin id'),
    /** The name value. */
    name: requireBoundedString(candidate.name, 'Plugin name', 100),
    /** The version value. */
    version: requireVersion(candidate.version, 'Plugin version'),
    /** The API version value. */
    apiVersion: KAWAIKARA_SITE_API_VERSION,
    /** The main value. */
    main: validateMain(candidate.main, 'Plugin main'),
    /** The provider IDs value. */
    providerIds: validateIdArray(candidate.providerIds, 'Plugin providerIds'),
  });
}

/** Validates the manifest header. */
export function validateManifestHeader(
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

/** Validates the main. */
export function validateMain(value: unknown, field: string): string {
  const main = requireSafeRelativePath(value, field);
  if (!/\.(?:cjs|js)$/i.test(main)) {
    throw new Error(`${field} must point to a CommonJS .cjs or .js file.`);
  }
  return main;
}

/** Validates the bundle update manifest. */
export function validateBundleUpdateManifest(
  value: unknown,
): BundleUpdateManifest | undefined {
  if (value === undefined) return undefined;
  const candidate = requireObject(value, 'Bundle update');
  if (candidate.type === 'archive') {
    return Object.freeze({
      /** The type value. */
      type: 'archive',
      /** The URL value. */
      url: validateUpdateUrl(candidate.url, 'Bundle update URL')!,
    });
  }
  if (candidate.type === 'resolver') {
    return Object.freeze({
      /** The type value. */
      type: 'resolver',
      /** The main value. */
      main: validateMain(candidate.main, 'Bundle update resolver main'),
    });
  }
  throw new Error('Bundle update type must be archive or resolver.');
}

/** Validates the update URL. */
export function validateUpdateUrl(
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

/** Validates the permissions. */
export function validatePermissions(
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

/** Validates the path array. */
export function validatePathArray(
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

/** Validates the ID array. */
export function validateIdArray(value: unknown, field: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  const values = value.map((item) => requireId(item, field));
  return Object.freeze([...new Set(values)]);
}

/** Validates the locale. */
export function validateLocale(value: unknown): BundleLocaleContribution | undefined {
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
  return Object.freeze({
    /** The supported locales value. */
    supportedLocales,
    /** The default locale value. */
    defaultLocale,
  });
}

/** Validates the browser profiles. */
export function validateBrowserProfiles(
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

/** Reads the JSON. */
export async function readJson(filePath: string, label: string): Promise<unknown> {
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

/** Resolves the owned directory. */
export async function resolveOwnedDirectory(
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

/** Resolves the owned entry. */
export async function resolveOwnedEntry(
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

/** Validates the extracted tree. */
export async function validateExtractedTree(rootPath: string): Promise<void> {
  let entries = 0;
  let bytes = 0;
  /** Performs the visit operation. */
  const visit = async (directoryPath: string): Promise<void> => {
    for (const entry of await readdir(directoryPath, { withFileTypes: true
    })) {
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

/** Ensures the site API bridge. */
export async function ensureSiteApiBridge(rootPath: string): Promise<void> {
  const bridgePath = path.join(
    rootPath,
    'node_modules',
    '@kawaikara',
    'site-api',
  );
  await rm(bridgePath, { recursive: true, force: true
  });
  await mkdir(bridgePath, { recursive: true
  });
  await writeFile(
    path.join(bridgePath, 'package.json'),
    `${JSON.stringify({
      name: '@kawaikara/site-api',
      version: `${String(KAWAIKARA_SITE_API_VERSION)}.0.0`,
      private: true,
      main: 'index.cjs',
    }, null, 2)}\n`,
    { flag: 'wx'
    },
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
    { flag: 'wx'
    },
  );
}

/** Creates the bundle info. */
export function createBundleInfo(
  bundle: BundleDefinition,
  source: BundleInfo['source'],
  status: BundleInfo['status'],
  permissions: readonly SitePermission[] = collectBundlePermissions(bundle),
): BundleInfo {
  return {
    /** The ID value. */
    id: bundle.id,
    /** The name value. */
    name: bundle.name ?? bundle.id,
    /** The description value. */
    description: bundle.description,
    /** The version value. */
    version: bundle.version,
    /** The updatable value. */
    updatable: Boolean(bundle.update ?? bundle.updateUrl),
    /** The update URL value. */
    updateUrl: bundle.updateUrl,
    /** The kind value. */
    kind: 'bundle',
    /** The source value. */
    source,
    /** The status value. */
    status,
    /** The provider count value. */
    providerCount: bundle.providers.length,
    /** The plugin count value. */
    pluginCount:
      bundle.plugins.length +
      bundle.providers.reduce(
        (total, provider) => total + provider.plugins.length,
        0,
      ),
    /** The permissions value. */
    permissions,
  };
}

/** Creates the inspected info. */
export function createInspectedInfo(
  bundle: InspectedBundle,
  status: BundleInfo['status'],
  source: BundleInfo['source'],
): BundleInfo {
  return {
    /** The ID value. */
    id: bundle.manifest.id,
    /** The name value. */
    name: bundle.manifest.name,
    /** The description value. */
    description: bundle.manifest.description,
    /** The version value. */
    version: bundle.manifest.version,
    /** The updatable value. */
    updatable: Boolean(bundle.manifest.update ?? bundle.manifest.updateUrl),
    /** The update URL value. */
    updateUrl: bundle.manifest.updateUrl,
    /** The kind value. */
    kind: 'bundle',
    /** The source value. */
    source,
    /** The status value. */
    status,
    /** The provider count value. */
    providerCount: bundle.providers.length,
    /** The plugin count value. */
    pluginCount:
      bundle.plugins.length +
      bundle.providers.reduce(
        (total, provider) => total + provider.plugins.length,
        0,
      ),
    /** The permissions value. */
    permissions: bundle.permissions,
  };
}

/** Collects the bundle permissions. */
export function collectBundlePermissions(bundle: BundleDefinition): readonly SitePermission[] {
  return [...bundle.permissions];
}

/** Performs the require ID operation. */
export function requireId(value: unknown, field: string): string {
  const id = requireBoundedString(value, field, 128);
  if (!ID_PATTERN.test(id)) {
    throw new Error(`${field} ${id} contains unsupported characters.`);
  }
  return id;
}

/** Performs the require version operation. */
export function requireVersion(value: unknown, field: string): string {
  const version = requireBoundedString(value, field, 80);
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`${field} ${version} is not valid SemVer.`);
  }
  return version;
}

/** Performs the compare sem ver operation. */
export function compareSemVer(left: string, right: string): number {
  /** Parses the operation. */
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
    return { core, prerelease
    };
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

/** Performs the require boolean operation. */
export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`);
  return value;
}

/** Determines whether the path inside condition applies. */
export function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Performs the path exists operation. */
export async function pathExists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Performs the download bundle archive operation. */
export async function downloadBundleArchive(url: string, destinationPath: string): Promise<void> {
  const response = await net.fetch(validateUpdateUrl(url)!, { redirect: 'follow'
  });
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
  await writeFile(destinationPath, bytes, { flag: 'wx'
  });
}

/** Performs the to error message operation. */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Returns the install copy. */
export function getInstallCopy(locale: AppLocale): {
  /** The choose title value. */
  readonly chooseTitle: string;
  /** The confirm title value. */
  readonly confirmTitle: string;
  /** The confirm message value. */
  readonly confirmMessage: string;
  /** The confirm detail value. */
  readonly confirmDetail: string;
  /** The permissions heading value. */
  readonly permissionsHeading: string;
  /** The no permissions value. */
  readonly noPermissions: string;
  /** The deny value. */
  readonly deny: string;
  /** Whether the allow and install option is enabled. */
  readonly allowAndInstall: string;
} {
  const language = locale === 'system' ? app.getLocale() : locale;
  if (language.toLowerCase().startsWith('ko')) {
    return {
      /** The choose title value. */
      chooseTitle: 'Kawaikara Bundle 선택',
      /** The confirm title value. */
      confirmTitle: 'Bundle 설치',
      /** The confirm message value. */
      confirmMessage: '“{name}” Bundle을 설치할까요?',
      /** The confirm detail value. */
      confirmDetail:
        '.kawai는 ZIP 컨테이너이며 Main 프로세스에서 실행되는 코드를 포함할 수 있습니다. 아래 권한을 검토하세요. 설치 후 앱을 다시 시작해야 합니다.',
      /** The permissions heading value. */
      permissionsHeading: '요청하는 권한',
      /** The no permissions value. */
      noPermissions: '추가 Provider 권한 없음',
      /** The deny value. */
      deny: '허가하지 않음',
      /** Whether the allow and install option is enabled. */
      allowAndInstall: '허가 및 설치',
    };
  }
  if (language.toLowerCase().startsWith('ja')) {
    return {
      /** The choose title value. */
      chooseTitle: 'Kawaikara Bundleを選択',
      /** The confirm title value. */
      confirmTitle: 'Bundleをインストール',
      /** The confirm message value. */
      confirmMessage: '「{name}」Bundleをインストールしますか？',
      /** The confirm detail value. */
      confirmDetail:
        '.kawaiはZIPコンテナで、Mainプロセスで実行されるコードを含む場合があります。以下の権限を確認してください。再起動後に有効になります。',
      /** The permissions heading value. */
      permissionsHeading: '要求する権限',
      /** The no permissions value. */
      noPermissions: '追加のProvider権限なし',
      /** The deny value. */
      deny: '許可しない',
      /** Whether the allow and install option is enabled. */
      allowAndInstall: '許可してインストール',
    };
  }
  return {
    /** The choose title value. */
    chooseTitle: 'Choose a Kawaikara Bundle',
    /** The confirm title value. */
    confirmTitle: 'Install Bundle',
    /** The confirm message value. */
    confirmMessage: 'Install the “{name}” Bundle?',
    /** The confirm detail value. */
    confirmDetail:
      '.kawai is a ZIP container and can include code that runs in the Main process. Review the permissions below. Restart Kawaikara to activate it.',
    /** The permissions heading value. */
    permissionsHeading: 'Requested permissions',
    /** The no permissions value. */
    noPermissions: 'No additional Provider permissions',
    /** The deny value. */
    deny: 'Deny',
    /** Whether the allow and install option is enabled. */
    allowAndInstall: 'Allow and install',
  };
}

/** Returns the bundle action copy. */
export function getBundleActionCopy(locale: AppLocale): {
  /** The update title value. */
  readonly updateTitle: string;
  /** The update message value. */
  readonly updateMessage: string;
  /** The remove title value. */
  readonly removeTitle: string;
  /** The remove message value. */
  readonly removeMessage: string;
  /** The restart detail value. */
  readonly restartDetail: string;
  /** Whether the cancel option is enabled. */
  readonly cancel: string;
  /** The update value. */
  readonly update: string;
  /** The remove value. */
  readonly remove: string;
} {
  const language = locale === 'system' ? app.getLocale() : locale;
  if (language.toLowerCase().startsWith('ko')) {
    return {
      /** The update title value. */
      updateTitle: 'Bundle 업데이트',
      /** The update message value. */
      updateMessage: '“{name}” Bundle을 업데이트할까요?',
      /** The remove title value. */
      removeTitle: 'Bundle 삭제',
      /** The remove message value. */
      removeMessage: '“{name}” Bundle을 삭제할까요?',
      /** The restart detail value. */
      restartDetail: '실행 중인 코드는 Kawaikara를 다시 시작한 뒤 변경됩니다.',
      /** Whether the cancel option is enabled. */
      cancel: '취소',
      /** The update value. */
      update: '업데이트',
      /** The remove value. */
      remove: '삭제',
    };
  }
  if (language.toLowerCase().startsWith('ja')) {
    return {
      /** The update title value. */
      updateTitle: 'Bundleを更新',
      /** The update message value. */
      updateMessage: '「{name}」Bundleを更新しますか？',
      /** The remove title value. */
      removeTitle: 'Bundleを削除',
      /** The remove message value. */
      removeMessage: '「{name}」Bundleを削除しますか？',
      /** The restart detail value. */
      restartDetail: '実行中のコードへの変更はKawaikaraの再起動後に反映されます。',
      /** Whether the cancel option is enabled. */
      cancel: 'キャンセル',
      /** The update value. */
      update: '更新',
      /** The remove value. */
      remove: '削除',
    };
  }
  return {
    /** The update title value. */
    updateTitle: 'Update Bundle',
    /** The update message value. */
    updateMessage: 'Update the “{name}” Bundle?',
    /** The remove title value. */
    removeTitle: 'Remove Bundle',
    /** The remove message value. */
    removeMessage: 'Remove the “{name}” Bundle?',
    /** The restart detail value. */
    restartDetail: 'Changes to running code take effect after restarting Kawaikara.',
    /** Whether the cancel option is enabled. */
    cancel: 'Cancel',
    /** The update value. */
    update: 'Update',
    /** The remove value. */
    remove: 'Remove',
  };
}

