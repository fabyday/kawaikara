import { findShortcutConflicts, writeShortcutOverride } from '../Shortcuts/ShortcutBindings';
import { ShortcutItem } from '../Types';
import { type usePreferenceDraft } from './usePreferenceDraft';
import { type usePreferenceState } from './usePreferenceState';
import { type useShortcutItems } from './useShortcutItems';

/** Inputs used by useShortcutOverrides. */
type ShortcutOverridesOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'draftPreferences'
  | 'setDraftPreferences'
  | 'setError'
  | 'setShortcutConflict'
  | 'shortcutConflict'
> & Pick<ReturnType<typeof useShortcutItems>,
  | 'allShortcutItems'
  | 'shortcutItemsById'
> & Pick<ReturnType<typeof usePreferenceDraft>,
  | 'updateDraft'
>;

/** Coordinates shortcut overrides behavior for this View. */
export function useShortcutOverrides({
  draftPreferences,
  setDraftPreferences,
  setError,
  allShortcutItems,
  setShortcutConflict,
  shortcutConflict,
  updateDraft,
  shortcutItemsById,
}: ShortcutOverridesOptions) {
  /** Updates the shortcut. */
  const updateShortcut = (item: ShortcutItem, accelerator: string) => {
    if (!draftPreferences) return;
    const previousShortcuts = {
      ...draftPreferences.shortcuts
    };
    const shortcuts = writeShortcutOverride(
      previousShortcuts,
      item,
      accelerator,
    );
    const nextPreferences = {
      ...draftPreferences, shortcuts
    };
    setDraftPreferences(nextPreferences);
    setError(undefined);

    const conflictingIds = findShortcutConflicts(
      item.id,
      allShortcutItems,
      shortcuts,
    );
    if (conflictingIds.length) {
      setShortcutConflict({
        targetId: item.id,
        conflictingIds,
        previousShortcuts,
      });
    }
  };

  /** Determines whether the cel shortcut overwrite condition applies. */
  const cancelShortcutOverwrite = () => {
    if (!shortcutConflict) return;
    updateDraft({
      shortcuts: shortcutConflict.previousShortcuts
    });
    setShortcutConflict(undefined);
  };

  /** Performs the confirm shortcut overwrite operation. */
  const confirmShortcutOverwrite = () => {
    if (!shortcutConflict) return;
    setDraftPreferences((current) => {
      if (!current) return current;
      const shortcuts = {
        ...current.shortcuts
      };
      for (const id of shortcutConflict.conflictingIds) shortcuts[id] = '';
      return {
        ...current, shortcuts
      };
    });
    setShortcutConflict(undefined);
  };

  const conflictNames = shortcutConflict?.conflictingIds
    .map((id) => shortcutItemsById.get(id)?.title ?? id)
    .join(', ');

  return {
    /** The updateShortcut value. */
    updateShortcut,
    /** The cancelShortcutOverwrite value. */
    cancelShortcutOverwrite,
    /** The confirmShortcutOverwrite value. */
    confirmShortcutOverwrite,
    /** The conflictNames value. */
    conflictNames,
  };
}
