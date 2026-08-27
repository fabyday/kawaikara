import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { watch } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AppLocale,
  DevelopmentBundleAttachResult,
  DevelopmentState,
  PreferenceState,
} from '../../Common/IPC';
import { MainProcessDebugger } from '../../Debug/MainProcessDebugger';
import { buildBundleProjectRevision } from '../../Development/BundleProjectBuilder';
import {
  DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY,
  readBundleProjectConfig,
} from '../../Development/BundleProjectConfig';
import {
  cloneDevelopmentProjectInfo,
  getChooseDevelopmentProjectTitle,
  removeProjectDevelopmentOutput,
  toDevelopmentErrorMessage,
  type DevelopmentProjectRuntime,
  type StoredDevelopmentProject,
} from '../Functional/BundleDevelopment';
import type { BundleManager } from './BundleManager';
import type { LoggingManager } from './LoggingManager';

/** Defines the shared ignored directory names constant. */
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.kawai-stage',
  '.kawaikara',
  'node_modules',
  'release',
]);

/** Coordinates bundle development behavior. */
export class BundleDevelopmentManager {
  /** The projects value. */
  private readonly projects = new Map<string, DevelopmentProjectRuntime>();
  /** The listeners value. */
  private readonly listeners = new Set<(state: DevelopmentState) => void>();
  /** The debugger value. */
  private readonly debugger = new MainProcessDebugger();
  /** The logger value. */
  private readonly logger;
  /** Whether the enabled option is enabled. */
  private enabled = false;
  /** The initialized value. */
  private initialized = false;
  /** The disposed value. */
  private disposed = false;

  /** Creates an instance of BundleDevelopmentManager. */
  constructor(
    /** The bundles value. */
    private readonly bundles: BundleManager,
    /** The state file path value. */
    private readonly stateFilePath: string,
    logging: LoggingManager,
  ) {
    this.logger = logging.createLogger('bundle-development');
  }

  /** Initializes the operation. */
  async initialize(preferences: PreferenceState): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    for (const stored of await this.readStoredProjects()) {
      this.projects.set(stored.id, {
        ...stored,
        name: path.basename(stored.projectPath),
        status: 'stopped',
        watchers: [],
        buildChain: Promise.resolve(),
      });
    }
    await this.configure(preferences);
  }

  /** Performs the configure operation. */
  async configure(preferences: PreferenceState): Promise<void> {
    if (this.disposed) return;
    this.debugger.configure(preferences);
    if (preferences.developmentMode === this.enabled) {
      this.emitState();
      return;
    }
    this.enabled = preferences.developmentMode;
    if (this.enabled) {
      for (const project of this.projects.values()) {
        await this.prepareProject(project, true);
      }
    } else {
      await Promise.all(
        [...this.projects.values()].map((project) => this.stopProject(project)),
      );
    }
    this.emitState();
  }

  /** Returns the state. */
  getState(): DevelopmentState {
    return {
      /** Whether the enabled option is enabled. */
      enabled: this.enabled,
      /** The debugger value. */
      debugger: this.debugger.getState(),
      /** The projects value. */
      projects: [...this.projects.values()]
        .map(cloneDevelopmentProjectInfo)
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  /** Subscribes to the operation. */
  subscribe(listener: (state: DevelopmentState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Attaches the from dialog. */
  async attachFromDialog(locale: AppLocale): Promise<DevelopmentBundleAttachResult> {
    this.assertEnabled();
    const selection = await dialog.showOpenDialog({
      title: getChooseDevelopmentProjectTitle(locale),
      properties: ['openDirectory'],
    });
    const selectedPath = selection.filePaths[0];
    if (selection.canceled || !selectedPath) return {
      /** The status value. */
      status: 'cancelled',
    };

    const config = await readBundleProjectConfig(selectedPath);
    const existing = [...this.projects.values()].find(
      (project) => project.projectPath === config.projectPath,
    );
    if (existing) {
      await this.prepareProject(existing, true);
      return {
        /** The status value. */
        status: 'attached',
        /** The project value. */
        project: cloneDevelopmentProjectInfo(existing),
      };
    }

    const project: DevelopmentProjectRuntime = {
      id: randomUUID(),
      projectPath: config.projectPath,
      name: path.basename(config.projectPath),
      hotReload: true,
      outputDirectory: config.outputDirectory,
      status: 'stopped',
      config,
      watchers: [],
      buildChain: Promise.resolve(),
    };
    this.projects.set(project.id, project);
    await this.persist();
    await this.prepareProject(project, true);
    return {
      /** The status value. */
      status: 'attached',
      /** The project value. */
      project: cloneDevelopmentProjectInfo(project),
    };
  }

  /** Performs the rebuild operation. */
  async rebuild(projectId: string): Promise<DevelopmentState> {
    this.assertEnabled();
    const project = this.requireProject(projectId);
    await this.enqueueBuild(project);
    return this.getState();
  }

  /** Sets the hot reload. */
  async setHotReload(
    projectId: string,
    enabled: boolean,
  ): Promise<DevelopmentState> {
    const project = this.requireProject(projectId);
    project.hotReload = enabled;
    if (this.enabled) {
      if (enabled) await this.startWatching(project);
      else this.stopWatching(project);
    }
    await this.persist();
    this.emitState();
    return this.getState();
  }

  /** Detaches the operation. */
  async detach(projectId: string): Promise<DevelopmentState> {
    const project = this.requireProject(projectId);
    this.stopWatching(project);
    await project.buildChain.catch(() => undefined);
    if (project.bundleId) {
      await this.bundles.detachDevelopmentBundle(
        project.bundleId,
        true,
        project.id,
      );
    }
    this.projects.delete(project.id);
    await Promise.all([
      this.persist(),
      removeProjectDevelopmentOutput(
        project.projectPath,
        project.outputDirectory,
      ),
    ]);
    this.emitState();
    return this.getState();
  }

  /** Creates the vs code configuration. */
  createVsCodeConfiguration(): string {
    return this.debugger.createVsCodeConfiguration();
  }

  /** Releases the operation. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    for (const project of this.projects.values()) this.stopWatching(project);
    await Promise.all(
      [...this.projects.values()].map(async (project) => {
        await project.buildChain.catch(() => undefined);
        if (project.bundleId) {
          await this.bundles.detachDevelopmentBundle(
            project.bundleId,
            false,
            project.id,
          );
        }
      }),
    );
    this.debugger.dispose();
    this.listeners.clear();
  }

  /** Prepares the project. */
  private async prepareProject(
    project: DevelopmentProjectRuntime,
    buildImmediately: boolean,
  ): Promise<void> {
    try {
      project.config = await readBundleProjectConfig(project.projectPath);
      if (project.hotReload) await this.startWatching(project);
      if (buildImmediately) await this.enqueueBuild(project);
      else {
        project.status = project.hotReload ? 'watching' : 'stopped';
        project.error = undefined;
        this.emitState();
      }
    } catch (error) {
      this.setProjectFailure(project, error);
    }
  }

  /** Performs the enqueue build operation. */
  private enqueueBuild(project: DevelopmentProjectRuntime): Promise<void> {
    project.buildChain = project.buildChain
      .catch(() => undefined)
      .then(() => this.buildProject(project));
    return project.buildChain;
  }

  /** Builds the project. */
  private async buildProject(project: DevelopmentProjectRuntime): Promise<void> {
    if (!this.enabled || !this.projects.has(project.id)) return;
    project.status = 'building';
    project.error = undefined;
    this.emitState();
    try {
      const config = await readBundleProjectConfig(project.projectPath);
      if (config.outputDirectory !== project.outputDirectory) {
        throw new Error(
          'Development outputDirectory changed. Detach and reattach the project.',
        );
      }
      project.config = config;
      const result = await buildBundleProjectRevision(config);
      project.status = 'reloading';
      this.emitState();
      const bundle = await this.bundles.activateDevelopmentBundle(
        result.rootPath,
        project.id,
        project.bundleId,
      );
      project.bundleId = bundle.id;
      project.revision = result.revision;
      project.lastBuiltAt = result.builtAt;
      project.status = 'active';
      project.error = undefined;
      if (project.hotReload) await this.startWatching(project);
      await this.persist();
      this.logger.info('Development Bundle activated.', {
        projectId: project.id,
        bundleId: project.bundleId,
        revision: project.revision,
      });
      this.emitState();
    } catch (error) {
      this.setProjectFailure(project, error);
    }
  }

  /** Starts the watching. */
  private async startWatching(project: DevelopmentProjectRuntime): Promise<void> {
    if (!this.enabled || !project.hotReload) return;
    this.stopWatching(project);
    const config = project.config ?? await readBundleProjectConfig(project.projectPath);
    project.config = config;
    for (const watchPath of config.watchPaths) {
      const watchStat = await stat(watchPath);
      const watcher = watch(
        watchPath,
        { recursive: watchStat.isDirectory()
        },
        (_event, fileName) => {
          if (!this.shouldHandleWatchEvent(fileName?.toString())) return;
          if (project.debounceTimer) clearTimeout(project.debounceTimer);
          project.debounceTimer = setTimeout(() => {
            project.debounceTimer = undefined;
            if (this.enabled && project.hotReload && this.projects.has(project.id)) {
              void this.enqueueBuild(project);
            }
          }, 250);
        },
      );
      watcher.on('error', (error) => this.setProjectFailure(project, error));
      project.watchers.push(watcher);
    }
    if (!project.revision) project.status = 'watching';
    this.emitState();
  }

  /** Stops the watching. */
  private stopWatching(project: DevelopmentProjectRuntime): void {
    if (project.debounceTimer) clearTimeout(project.debounceTimer);
    project.debounceTimer = undefined;
    for (const watcher of project.watchers.splice(0)) watcher.close();
  }

  /** Stops the project. */
  private async stopProject(project: DevelopmentProjectRuntime): Promise<void> {
    this.stopWatching(project);
    await project.buildChain.catch(() => undefined);
    if (project.bundleId) {
      await this.bundles.detachDevelopmentBundle(
        project.bundleId,
        true,
        project.id,
      );
    }
    project.status = 'stopped';
    project.error = undefined;
  }

  /** Determines whether the handle watch event condition applies. */
  private shouldHandleWatchEvent(fileName: string | undefined): boolean {
    if (!fileName) return true;
    return !fileName
      .split(/[\\/]/)
      .some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
  }

  /** Sets the project failure. */
  private setProjectFailure(project: DevelopmentProjectRuntime, error: unknown): void {
    project.status = 'failed';
    project.error = toDevelopmentErrorMessage(error);
    this.logger.error('Development Bundle operation failed.', {
      projectId: project.id,
      bundleId: project.bundleId,
      error,
    });
    this.emitState();
  }

  /** Performs the require project operation. */
  private requireProject(id: string): DevelopmentProjectRuntime {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Unknown development project ${id}.`);
    return project;
  }

  /** Asserts the enabled. */
  private assertEnabled(): void {
    if (!this.enabled) {
      throw new Error('Enable Kawaikara development mode first.');
    }
  }

  /** Performs the emit state operation. */
  private emitState(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  /** Reads the stored projects. */
  private async readStoredProjects(): Promise<StoredDevelopmentProject[]> {
    try {
      const value = JSON.parse(await readFile(this.stateFilePath, 'utf8')) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const projects = (value as { readonly projects?: unknown
      }).projects;
      if (!Array.isArray(projects)) return [];
      return projects.flatMap((item): StoredDevelopmentProject[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const candidate = item as Record<string, unknown>;
        if (
          typeof candidate.id !== 'string' ||
          typeof candidate.projectPath !== 'string'
        ) {
          return [];
        }
        return [{
          id: candidate.id,
          projectPath: candidate.projectPath,
          hotReload: candidate.hotReload !== false,
          bundleId: typeof candidate.bundleId === 'string'
            ? candidate.bundleId
            : undefined,
          outputDirectory: typeof candidate.outputDirectory === 'string'
            ? candidate.outputDirectory
            : DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY,
        }];
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Development project state could not be read.', error);
      }
      return [];
    }
  }

  /** Performs the persist operation. */
  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.stateFilePath), { recursive: true
    });
    const projects: StoredDevelopmentProject[] = [...this.projects.values()].map(
      ({ id, projectPath, hotReload, bundleId, outputDirectory }) => ({
        id,
        projectPath,
        hotReload,
        bundleId,
        outputDirectory,
      }),
    );
    await writeFile(
      this.stateFilePath,
      `${JSON.stringify({ schemaVersion: 1, projects
      }, null, 2)}\n`,
      'utf8',
    );
  }
}
