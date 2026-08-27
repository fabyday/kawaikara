import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { ResolvedBundleProjectConfig } from './BundleProjectConfig';

/** Defines the shared retained revision count constant. */
const RETAINED_REVISION_COUNT = 3;
/** Defines the shared source file pattern constant. */
const SOURCE_FILE_PATTERN = /\.(?:[cm]?tsx?)$/i;

/** Describes the bundle development build result contract. */
export interface BundleDevelopmentBuildResult {
  /** The revision value. */
  readonly revision: string;
  /** The root path value. */
  readonly rootPath: string;
  /** The built at value. */
  readonly builtAt: string;
}

/** Builds one immutable revision. The caller activates it only after validation. */
export async function buildBundleProjectRevision(
  config: ResolvedBundleProjectConfig,
  outputPath = config.outputPath,
): Promise<BundleDevelopmentBuildResult> {
  const revision = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const resolvedOutputPath = path.resolve(outputPath);
  assertProjectOwnedOutputPath(config.projectPath, resolvedOutputPath);
  await ensureProjectDirectoryChain(config.projectPath, resolvedOutputPath);
  const revisionsPath = path.join(resolvedOutputPath, 'revisions');
  await ensureRealDirectory(revisionsPath);
  // Keep staging and final revisions at the same depth so relative source-map
  // paths remain valid after the atomic rename.
  const stagingPath = path.join(revisionsPath, `.building-${revision}`);
  const revisionPath = path.join(revisionsPath, revision);
  await mkdir(stagingPath, { recursive: false
  });

  try {
    await cp(config.sourcePath, stagingPath, {
      recursive: true,
      filter: (source) => {
        if (source === config.sourcePath) return true;
        return !SOURCE_FILE_PATTERN.test(source);
      },
    });
    await build({
      absWorkingDir: config.projectPath,
      bundle: true,
      entryPoints: [...config.entryPaths],
      entryNames: '[dir]/[name]',
      external: ['@kawaikara/site-api'],
      format: 'cjs',
      logLevel: 'silent',
      outbase: config.sourcePath,
      outdir: stagingPath,
      outExtension: { '.js': '.js'
      },
      platform: 'node',
      sourcemap: 'external',
      sourcesContent: true,
      target: 'node22',
      tsconfig: path.join(config.projectPath, 'tsconfig.json'),
    });
    await rename(stagingPath, revisionPath);
    await pruneOldRevisions(revisionsPath, revision);
    return {
      /** The revision value. */
      revision,
      /** The root path value. */
      rootPath: revisionPath,
      /** The built at value. */
      builtAt: new Date().toISOString(),
    };
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true
    });
    throw error;
  }
}

/** Asserts the project owned output path. */
function assertProjectOwnedOutputPath(projectPath: string, outputPath: string): void {
  const relation = path.relative(projectPath, outputPath);
  if (
    !relation ||
    relation === '..' ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    throw new Error('Development output must stay inside the Bundle project.');
  }
}

/** Ensures the project directory chain. */
async function ensureProjectDirectoryChain(
  projectPath: string,
  directoryPath: string,
): Promise<void> {
  const relativeSegments = path.relative(projectPath, directoryPath).split(path.sep);
  let currentPath = projectPath;
  for (const segment of relativeSegments) {
    currentPath = path.join(currentPath, segment);
    await ensureRealDirectory(currentPath);
  }
}

/** Ensures the real directory. */
async function ensureRealDirectory(directoryPath: string): Promise<void> {
  try {
    const directoryStat = await lstat(directoryPath);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      throw new Error(
        `Development output path must be a real directory: ${directoryPath}`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(directoryPath, { recursive: false
    });
  }
  // Development output must never escape the selected project through a
  // symlink substituted between validation and creation.
  const resolvedDirectory = await realpath(directoryPath);
  if (resolvedDirectory !== directoryPath) {
    throw new Error(
      `Development output path must not contain symbolic links: ${directoryPath}`,
    );
  }
}

/** Performs the prune old revisions operation. */
async function pruneOldRevisions(
  revisionsPath: string,
  activeRevision: string,
): Promise<void> {
  const entries = (await readdir(revisionsPath, { withFileTypes: true
  }))
    .filter((entry) => entry.isDirectory() && entry.name !== activeRevision)
    .map((entry) => entry.name)
    .sort()
    .reverse();
  await Promise.all(
    entries.slice(RETAINED_REVISION_COUNT - 1).map((entry) =>
      rm(path.join(revisionsPath, entry), { recursive: true, force: true
      }),
    ),
  );
}
