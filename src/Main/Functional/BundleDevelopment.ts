import { type FSWatcher } from 'node:fs';
import { rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  AppLocale,
  DevelopmentBundleProjectInfo,
  DevelopmentBundleStatus,
} from '../../Common/IPC';
import {
  resolveBundleProjectDevelopmentPath,
  type ResolvedBundleProjectConfig,
} from '../../Development/BundleProjectConfig';

/** Describes the stored development project contract. */
export interface StoredDevelopmentProject {
  /** The ID value. */
  readonly id: string;
  /** The project path value. */
  readonly projectPath: string;
  /** Whether the hot reload option is enabled. */
  readonly hotReload: boolean;
  /** The bundle ID value. */
  readonly bundleId?: string;
  /** The output directory value. */
  readonly outputDirectory: string;
}

/** Describes the development project runtime contract. */
export interface DevelopmentProjectRuntime {
  /** The ID value. */
  id: string;
  /** The project path value. */
  projectPath: string;
  /** The name value. */
  name: string;
  /** Whether the hot reload option is enabled. */
  hotReload: boolean;
  /** The bundle ID value. */
  bundleId?: string;
  /** The output directory value. */
  outputDirectory: string;
  /** The status value. */
  status: DevelopmentBundleStatus;
  /** The revision value. */
  revision?: string;
  /** The last built at value. */
  lastBuiltAt?: string;
  /** The error value. */
  error?: string;
  /** The config value. */
  config?: ResolvedBundleProjectConfig;
  /** The watchers value. */
  watchers: FSWatcher[];
  /** The debounce timer value. */
  debounceTimer?: NodeJS.Timeout;
  /** The build chain value. */
  buildChain: Promise<void>;
}

/** Performs the clone development project info operation. */
export function cloneDevelopmentProjectInfo(
  project: DevelopmentProjectRuntime,
): DevelopmentBundleProjectInfo {
  return {
    /** The ID value. */
    id: project.id,
    /** The name value. */
    name: project.name,
    /** The project path value. */
    projectPath: project.projectPath,
    /** The output directory value. */
    outputDirectory: project.outputDirectory,
    /** The bundle ID value. */
    bundleId: project.bundleId,
    /** The hot reload value. */
    hotReload: project.hotReload,
    /** The status value. */
    status: project.status,
    /** The revision value. */
    revision: project.revision,
    /** The last built at value. */
    lastBuiltAt: project.lastBuiltAt,
    /** The error value. */
    error: project.error,
  };
}

/** Returns the choose development project title. */
export function getChooseDevelopmentProjectTitle(locale: AppLocale): string {
  if (locale === 'ko-KR') return '개발 번들 프로젝트 선택';
  if (locale === 'ja-JP') return '開発Bundleプロジェクトを選択';
  return 'Choose a development Bundle project';
}

/** Performs the to development error message operation. */
export function toDevelopmentErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Removes the project development output. */
export async function removeProjectDevelopmentOutput(
  projectPath: string,
  outputDirectory: string,
): Promise<void> {
  const outputPath = resolveBundleProjectDevelopmentPath(
    projectPath,
    outputDirectory,
  );
  await rm(outputPath, { recursive: true, force: true
  });
  const parentPath = path.dirname(outputPath);
  if (parentPath !== path.join(projectPath, '.kawaikara')) return;
  await rmdir(parentPath).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
  });
}
