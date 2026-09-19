import {
  useMemo
} from 'react';
import {
  type MultiSelectFilterOption
} from '../../../Component/MultiSelectFilter';
import { toLogFileReference } from '../LogFormatting';
import { LOG_LEVELS } from '../LogViewerDefaults';
import { LogViewerProps } from '../Types';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogFilters. */
type LogFiltersOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'document'
  | 'excludedLevels'
  | 'excludedSources'
  | 'query'
  | 'groupQuery'
  | 'groups'
  | 'files'
  | 'selectedFileNames'
> & Pick<LogViewerProps,
  | 'locale'
>;

/** Coordinates log filters behavior for this View. */
export function useLogFilters({
  document,
  locale,
  excludedLevels,
  excludedSources,
  query,
  groupQuery,
  groups,
  files,
  selectedFileNames,
}: LogFiltersOptions) {
  const sourceLabels = useMemo(
    () => new Map(document?.metadata?.sources.map((source) => [
      source.id,
      source.label,
    ]) ?? []),
    [document?.metadata?.sources],
  );

  const sourceOptions = useMemo<MultiSelectFilterOption[]>(
    () => [...new Set(document?.entries.map((entry) => entry.source) ?? [])]
      .sort((left, right) => {
        const leftLabel = sourceLabels.get(left) ?? left;
        const rightLabel = sourceLabels.get(right) ?? right;
        return leftLabel.localeCompare(rightLabel, locale);
      })
      .map((source) => ({
        value: source,
        label: sourceLabels.get(source) ?? source,
      })),
    [document?.entries, locale, sourceLabels],
  );

  const levelOptions = useMemo<MultiSelectFilterOption[]>(
    () => LOG_LEVELS.map((level) => ({
      value: level,
      label: level.toUpperCase(),
      className: `log-viewer-level is-${level}`,
    })),
    [],
  );

  const selectedLevels = useMemo(
    () => new Set(levelOptions.map((option) => option.value)
      .filter((value) => !excludedLevels.has(value))),
    [excludedLevels, levelOptions],
  );

  const selectedSources = useMemo(
    () => new Set(sourceOptions.map((option) => option.value)
      .filter((value) => !excludedSources.has(value))),
    [excludedSources, sourceOptions],
  );

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return (document?.entries ?? []).filter((entry) => {
      if (excludedLevels.has(entry.level) || excludedSources.has(entry.source)) {
        return false;
      }
      if (!normalizedQuery) return true;
      return `${entry.timestamp ?? ''} ${entry.level} ${entry.location} ${entry.message}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    });
  }, [document?.entries, excludedLevels, excludedSources, locale, query]);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = groupQuery.trim().toLocaleLowerCase(locale);
    if (!normalizedQuery) return groups;
    return groups.filter((group) =>
      `${group.alias} ${group.id} ${group.sourceDeviceIds.join(' ')}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery));
  }, [groupQuery, groups, locale]);

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedFileNames.has(file.fileName)),
    [files, selectedFileNames],
  );

  const selectedReferences = useMemo(
    () => selectedFiles.map(toLogFileReference),
    [selectedFiles],
  );

  return {
    /** The sourceOptions value. */
    sourceOptions,
    /** The levelOptions value. */
    levelOptions,
    /** The selectedLevels value. */
    selectedLevels,
    /** The selectedSources value. */
    selectedSources,
    /** The visibleEntries value. */
    visibleEntries,
    /** The visibleGroups value. */
    visibleGroups,
    /** The selectedFiles value. */
    selectedFiles,
    /** The selectedReferences value. */
    selectedReferences,
  };
}
