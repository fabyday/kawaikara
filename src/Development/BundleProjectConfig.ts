import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

/** Defines the shared development config name constant. */
export const DEVELOPMENT_CONFIG_NAME = 'kawaikara.dev.json';
/** Defines the shared default development output directory constant. */
export const DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY =
  '.kawaikara/development';

/** Describes the bundle project config contract. */
export interface BundleProjectConfig {
  /** The schema version value. */
  readonly schemaVersion: 1;
  /** The source directory value. */
  readonly sourceDirectory: string;
  /** The entry points value. */
  readonly entryPoints: readonly string[];
  /** The watch value. */
  readonly watch: readonly string[];
}

/** Describes the resolved bundle project config contract. */
export interface ResolvedBundleProjectConfig extends BundleProjectConfig {
  /** The project path value. */
  readonly projectPath: string;
  /** The source path value. */
  readonly sourcePath: string;
  /** The entry paths value. */
  readonly entryPaths: readonly string[];
  /** The watch paths value. */
  readonly watchPaths: readonly string[];
  /** The output directory value. */
  readonly outputDirectory: string;
  /** The output path value. */
  readonly outputPath: string;
}

/** Reads the bundle project config. */
export async function readBundleProjectConfig(
  selectedPath: string,
): Promise<ResolvedBundleProjectConfig> {
  const projectPath = await realpath(selectedPath);
  const projectStat = await stat(projectPath);
  if (!projectStat.isDirectory()) {
    throw new Error('A Bundle development project must be a directory.');
  }

  const raw = JSON.parse(
    await readFile(path.join(projectPath, DEVELOPMENT_CONFIG_NAME), 'utf8'),
  ) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${DEVELOPMENT_CONFIG_NAME} must contain an object.`);
  }
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) {
    throw new Error(`${DEVELOPMENT_CONFIG_NAME} schemaVersion must be 1.`);
  }

  const sourceDirectory = requireRelativePath(
    candidate.sourceDirectory ?? 'src',
    'sourceDirectory',
  );
  const entryPoints = requirePathArray(candidate.entryPoints, 'entryPoints', false);
  const watch = requirePathArray(
    candidate.watch ?? [sourceDirectory, DEVELOPMENT_CONFIG_NAME, 'package.json'],
    'watch',
    false,
  );
  const sourcePath = await resolveOwnedDirectory(projectPath, sourceDirectory);
  const entryPaths = await Promise.all(
    entryPoints.map((entry) => resolveOwnedFile(sourcePath, entry)),
  );
  const watchPaths = await Promise.all(
    watch.map((entry) => resolveOwnedExistingPath(projectPath, entry)),
  );
  const outputDirectory = await readDevelopmentOutputDirectory(projectPath);
  const outputPath = resolveBundleProjectDevelopmentPath(
    projectPath,
    outputDirectory,
  );
  assertPathsDoNotOverlap(sourcePath, outputPath, 'sourceDirectory');
  for (const watchPath of watchPaths) {
    if ((await stat(watchPath)).isDirectory()) {
      assertPathsDoNotOverlap(watchPath, outputPath, 'watch');
    }
  }

  return {
    /** The schema version value. */
    schemaVersion: 1,
    /** The project path value. */
    projectPath,
    /** The source directory value. */
    sourceDirectory,
    /** The source path value. */
    sourcePath,
    /** The entry points value. */
    entryPoints,
    /** The entry paths value. */
    entryPaths,
    /** The watch value. */
    watch,
    /** The watch paths value. */
    watchPaths,
    /** The output directory value. */
    outputDirectory,
    /** The output path value. */
    outputPath,
  };
}

/** Resolves the bundle project development path. */
export function resolveBundleProjectDevelopmentPath(
  projectPath: string,
  outputDirectory = DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY,
): string {
  const normalized = requireRelativePath(
    outputDirectory,
    'kawaikara.development.outputDirectory',
  );
  const outputPath = path.resolve(projectPath, normalized);
  const relation = path.relative(projectPath, outputPath);
  if (
    !relation ||
    relation === '..' ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    throw new Error('Development output must stay inside the Bundle project.');
  }
  return outputPath;
}

/** Performs the require path array operation. */
function requirePathArray(
  value: unknown,
  field: string,
  optional: boolean,
): readonly string[] {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array.`);
  }
  const result = value.map((entry) => requireRelativePath(entry, field));
  if (new Set(result).size !== result.length) {
    throw new Error(`${field} contains duplicate paths.`);
  }
  return result;
}

/** Performs the require relative path operation. */
function requireRelativePath(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) {
    throw new Error(`${field} must contain a valid relative path.`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`${field} must stay inside the Bundle project.`);
  }
  return normalized;
}

/** Resolves the owned directory. */
async function resolveOwnedDirectory(root: string, relative: string): Promise<string> {
  const owned = await resolveOwnedExistingPath(root, relative);
  if (!(await stat(owned)).isDirectory()) {
    throw new Error(`${relative} must be a directory.`);
  }
  return owned;
}

/** Resolves the owned file. */
async function resolveOwnedFile(root: string, relative: string): Promise<string> {
  const owned = await resolveOwnedExistingPath(root, relative);
  if (!(await stat(owned)).isFile()) {
    throw new Error(`${relative} must be a file.`);
  }
  if (!/\.(?:[cm]?[jt]sx?)$/i.test(owned)) {
    throw new Error(`${relative} must be a JavaScript or TypeScript entry.`);
  }
  return owned;
}

/** Resolves the owned existing path. */
async function resolveOwnedExistingPath(
  root: string,
  relative: string,
): Promise<string> {
  const target = await realpath(path.resolve(root, relative));
  const relation = path.relative(root, target);
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    throw new Error(`${relative} resolves outside the Bundle project.`);
  }
  return target;
}

/** Reads the development output directory. */
async function readDevelopmentOutputDirectory(
  projectPath: string,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(path.join(projectPath, 'package.json'), 'utf8'),
    ) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY;
    }
    if (error instanceof SyntaxError) {
      throw new Error('package.json is not valid JSON.');
    }
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('package.json must contain an object.');
  }
  const kawaikara = (parsed as Record<string, unknown>).kawaikara;
  if (kawaikara === undefined) return DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY;
  if (!kawaikara || typeof kawaikara !== 'object' || Array.isArray(kawaikara)) {
    throw new Error('package.json kawaikara must contain an object.');
  }
  const development = (kawaikara as Record<string, unknown>).development;
  if (development === undefined) return DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY;
  if (
    !development ||
    typeof development !== 'object' ||
    Array.isArray(development)
  ) {
    throw new Error('package.json kawaikara.development must contain an object.');
  }
  return requireRelativePath(
    (development as Record<string, unknown>).outputDirectory ??
      DEFAULT_DEVELOPMENT_OUTPUT_DIRECTORY,
    'kawaikara.development.outputDirectory',
  );
}

/** Asserts the paths do not overlap. */
function assertPathsDoNotOverlap(
  ownedPath: string,
  outputPath: string,
  field: string,
): void {
  if (isSameOrInside(ownedPath, outputPath) || isSameOrInside(outputPath, ownedPath)) {
    throw new Error(
      `Development output must not overlap ${field}: ${outputPath}`,
    );
  }
}

/** Determines whether the same or inside condition applies. */
function isSameOrInside(root: string, candidate: string): boolean {
  const relation = path.relative(root, candidate);
  return relation === '' || (
    relation !== '..' &&
    !relation.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relation)
  );
}
