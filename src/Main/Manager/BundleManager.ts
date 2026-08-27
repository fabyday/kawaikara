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
  type ProviderLocaleResource,
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
import {
  optionalBoundedString,
  requireBoundedString,
  requireJsonObject as requireObject,
  requireSafeRelativePath,
  validateProviderLocaleContribution,
  validateProviderLocaleResource,
  validateStringArray,
} from '../Functional/BundleValidation';
import { evictRequireCache } from '../Functional/ModuleCache';
import {
  MAX_ARCHIVE_BYTES,
  compareSemVer,
  createBundleInfo,
  createInspectedInfo,
  downloadBundleArchive,
  ensureSiteApiBridge,
  extractArchive,
  findBundleRoot,
  getBundleActionCopy,
  getBundleUpdateDefinition,
  getInstallCopy,
  inspectBundle,
  loadBundleDefinition,
  loadBundleUpdateDefinition,
  pathExists,
  readBundleManifest,
  resolveBundleUpdateUrl,
  toErrorMessage,
  validateExtractedTree,
  type InspectedBundle,
} from '../Functional/BundleRuntime';
import { PluginHost } from '../Plugin/PluginHost';
import type { SiteManager } from './SiteManager';


/** Coordinates bundle behavior. */
export class BundleManager {
  /** The host value. */
  private readonly host: PluginHost;
  /** The records value. */
  private readonly records = new Map<string, BundleInfo>();
  /** The bundled definitions value. */
  private readonly bundledDefinitions = new Map<string, BundleDefinition>();
  /** The activated bundle IDs value. */
  private readonly activatedBundleIds = new Set<string>();
  /** The update definitions value. */
  private readonly updateDefinitions = new Map<string, BundleUpdateDefinition>();
  /** The development roots value. */
  private readonly developmentRoots = new Map<string, string>();
  /** The development owners value. */
  private readonly developmentOwners = new Map<string, string>();
  /** The development operation chain value. */
  private developmentOperationChain: Promise<void> = Promise.resolve();

  /** Creates an instance of BundleManager. */
  constructor(
    /** The site manager value. */
    private readonly siteManager: SiteManager,
    /** The bundle directory path value. */
    private readonly bundleDirectoryPath: string,
  ) {
    this.host = new PluginHost(siteManager);
  }

  /** Installs the bundled. */
  installBundled(bundle: BundleDefinition): void {
    if (this.bundledDefinitions.has(bundle.id)) {
      throw new Error(`Built-in Bundle ${bundle.id} is already registered.`);
    }
    this.bundledDefinitions.set(bundle.id, bundle);
    this.setUpdateDefinition(bundle.id, getBundleUpdateDefinition(bundle));
    this.records.set(bundle.id, createBundleInfo(bundle, 'built-in', 'active'));
  }

  /** Loads the installed. */
  async loadInstalled(): Promise<void> {
    await mkdir(this.bundleDirectoryPath, { recursive: true
    });
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

  /** Lists the operation. */
  list(): BundleInfo[] {
    const sourceOrder: Record<BundleInfo['source'], number> = {
      'built-in': 0,
      development: 1,
      user: 2,
    };
    return [...this.records.values()].sort(
      (left, right) =>
        sourceOrder[left.source] - sourceOrder[right.source] ||
        left.name.localeCompare(right.name),
    );
  }

  /** Validates and activates one immutable local development revision. */
  async activateDevelopmentBundle(
    rootPath: string,
    ownerId: string,
    expectedBundleId?: string,
  ): Promise<BundleInfo> {
    return this.enqueueDevelopmentOperation(() =>
      this.activateDevelopmentBundleRevision(
        rootPath,
        ownerId,
        expectedBundleId,
      ),
    );
  }

  /** Performs the activate development bundle revision operation. */
  private async activateDevelopmentBundleRevision(
    rootPath: string,
    ownerId: string,
    expectedBundleId?: string,
  ): Promise<BundleInfo> {
    const resolvedRoot = await realpath(rootPath);
    let manifest: BundleManifest | undefined;
    try {
      await validateExtractedTree(resolvedRoot);
      manifest = await readBundleManifest(resolvedRoot);
      if (expectedBundleId && manifest.id !== expectedBundleId) {
        throw new Error(
          `Development Bundle id changed from ${expectedBundleId} to ${manifest.id}.`,
        );
      }
      const current = this.records.get(manifest.id);
      if (current && current.source !== 'development') {
        throw new Error(
          `Bundle id ${manifest.id} is already owned by a ${current.source} Bundle.`,
        );
      }
      const currentOwner = this.developmentOwners.get(manifest.id);
      if (current && currentOwner !== ownerId) {
        throw new Error(
          `Development Bundle id ${manifest.id} is already attached by another project.`,
        );
      }
      const inspected = await inspectBundle(resolvedRoot, manifest);
      await ensureSiteApiBridge(resolvedRoot);
      const bundle = loadBundleDefinition(inspected);
      const previousRoot = this.developmentRoots.get(bundle.id);
      if (current) await this.host.replace(bundle);
      else this.host.install(bundle);

      this.activatedBundleIds.add(bundle.id);
      this.developmentRoots.set(bundle.id, resolvedRoot);
      this.developmentOwners.set(bundle.id, ownerId);
      this.setUpdateDefinition(bundle.id, undefined);
      const info = createBundleInfo(
        bundle,
        'development',
        'active',
        inspected.permissions,
      );
      this.records.set(bundle.id, info);
      if (previousRoot && previousRoot !== resolvedRoot) {
        evictRequireCache(previousRoot);
      }
      return info;
    } catch (error) {
      evictRequireCache(resolvedRoot);
      throw error;
    }
  }

  /** Detaches the development bundle. */
  async detachDevelopmentBundle(
    id: string,
    restoreFallback = true,
    ownerId?: string,
  ): Promise<void> {
    await this.enqueueDevelopmentOperation(() =>
      this.detachDevelopmentBundleRevision(id, restoreFallback, ownerId),
    );
  }

  /** Detaches the development bundle revision. */
  private async detachDevelopmentBundleRevision(
    id: string,
    restoreFallback: boolean,
    ownerId?: string,
  ): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.source !== 'development') return;
    if (ownerId && this.developmentOwners.get(id) !== ownerId) return;
    const root = this.developmentRoots.get(id);
    const { activeSiteId } = await this.host.uninstall(id);
    this.records.delete(id);
    this.updateDefinitions.delete(id);
    this.activatedBundleIds.delete(id);
    this.developmentRoots.delete(id);
    this.developmentOwners.delete(id);
    if (root) evictRequireCache(root);
    if (
      restoreFallback &&
      activeSiteId &&
      this.siteManager.has('kawaikara.youtube')
    ) {
      await this.siteManager.load('kawaikara.youtube');
    }
  }

  /** Performs the enqueue development operation operation. */
  private enqueueDevelopmentOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.developmentOperationChain.then(operation, operation);
    this.developmentOperationChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Installs the from dialog. */
  async installFromDialog(locale: AppLocale): Promise<BundleInstallResult> {
    const selection = await dialog.showOpenDialog({
      title: getInstallCopy(locale).chooseTitle,
      properties: ['openFile'],
      filters: [{ name: 'Kawaikara Bundle', extensions: ['kawai']
      }],
    });
    const archivePath = selection.filePaths[0];
    if (selection.canceled || !archivePath) return {
      /** The status value. */
      status: 'cancelled',
    };
    if (path.extname(archivePath).toLowerCase() !== '.kawai') {
      throw new Error('Kawaikara Bundles must use the .kawai extension.');
    }

    const archiveStat = await stat(archivePath);
    if (!archiveStat.isFile() || archiveStat.size > MAX_ARCHIVE_BYTES) {
      throw new Error('The .kawai Bundle must be a file no larger than 32 MB.');
    }

    await mkdir(this.bundleDirectoryPath, { recursive: true
    });
    const stagingPath = path.join(
      this.bundleDirectoryPath,
      `.installing-${randomUUID()}`,
    );
    await mkdir(stagingPath, { recursive: false
    });

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
      if (confirmation.response !== 1) return {
        /** The status value. */
        status: 'cancelled',
      };

      await rename(bundleRoot, destinationPath);
      let updateDefinition: BundleUpdateDefinition | undefined;
      try {
        await ensureSiteApiBridge(destinationPath);
        // Resolver modules are trusted Main code. Load them only after the
        // install consent dialog has been accepted and the Bundle is in place.
        updateDefinition = loadBundleUpdateDefinition(destinationPath, manifest);
      } catch (error) {
        await rm(destinationPath, { recursive: true, force: true
        });
        throw error;
      }
      const info = createInspectedInfo(inspected, 'restart-required', 'user');
      this.setUpdateDefinition(manifest.id, updateDefinition);
      this.records.set(info.id, info);
      return {
        /** The status value. */
        status: 'installed',
        /** The bundle value. */
        bundle: info,
      };
    } finally {
      await rm(stagingPath, { recursive: true, force: true
      });
    }
  }

  /** Updates the operation. */
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
    if (confirmation.response !== 1) return {
      /** The status value. */
      status: 'cancelled',
    };

    await mkdir(this.bundleDirectoryPath, { recursive: true
    });
    const token = randomUUID();
    const archivePath = path.join(this.bundleDirectoryPath, `.update-${token}.kawai`);
    const stagingPath = path.join(this.bundleDirectoryPath, `.updating-${token}`);
    const destinationPath = path.join(this.bundleDirectoryPath, id);
    const backupPath = path.join(this.bundleDirectoryPath, `.backup-${id}-${token}`);
    await mkdir(stagingPath, { recursive: false
    });
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
          await rm(destinationPath, { recursive: true, force: true
          });
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
      return {
        /** The status value. */
        status: 'updated',
        /** The bundle value. */
        bundle: info,
      };
    } finally {
      await rm(archivePath, { force: true
      });
      await rm(stagingPath, { recursive: true, force: true
      });
      if (backedUp) await rm(backupPath, { recursive: true, force: true
      });
    }
  }

  /** Removes the operation. */
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
    if (confirmation.response !== 1) return {
      /** The status value. */
      status: 'cancelled',
    };
    await rm(path.join(this.bundleDirectoryPath, id), {
      recursive: true,
      force: false,
    });
    this.records.delete(id);
    this.updateDefinitions.delete(id);
    return {
      /** The status value. */
      status: 'removed',
      /** The bundle ID value. */
      bundleId: id,
    };
  }

  /** Performs the require user bundle operation. */
  private requireUserBundle(id: string): BundleInfo {
    const bundle = this.requireBundle(id);
    if (!bundle || bundle.source !== 'user') {
      throw new Error(`User Bundle ${id} is not installed.`);
    }
    return bundle;
  }

  /** Performs the require bundle operation. */
  private requireBundle(id: string): BundleInfo {
    const bundle = this.records.get(id);
    if (!bundle) throw new Error(`Bundle ${id} is not installed.`);
    return bundle;
  }

  /** Sets the update definition. */
  private setUpdateDefinition(
    id: string,
    definition: BundleUpdateDefinition | undefined,
  ): void {
    if (definition) this.updateDefinitions.set(id, definition);
    else this.updateDefinitions.delete(id);
  }

  /** Loads the installed directory. */
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
