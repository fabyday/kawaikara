import {
  useEffect
} from 'react';
import {
  AUTO_HIDE_SCROLLBAR_DELAY_MS
} from '../../../Component/AutoHideScrollArea';
import type { SiteMenuGroup } from '../../../Domain/MenuOrder';
import {
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId,
  matchesKeyboardAccelerator
} from '../../../Domain/MenuOrder';
import { isEditableKeyboardTarget } from '../Logic/MenuInput';
import { type useMenuState } from './useMenuState';

/** Inputs used by useMenuShortcuts. */
type MenuShortcutsOptions = Pick<ReturnType<typeof useMenuState>,
  | 'menuVisible'
  | 'view'
  | 'preferences'
  | 'categoryElements'
  | 'reduceMotion'
  | 'setShortcutTargetCategory'
  | 'shortcutHighlightTimer'
  | 'addressInputRef'
> & {
  /** The groups value for this section. */
  readonly groups: SiteMenuGroup[];
};

/** Coordinates menu shortcuts behavior for this View. */
export function useMenuShortcuts({
  menuVisible,
  view,
  preferences,
  groups,
  categoryElements,
  reduceMotion,
  setShortcutTargetCategory,
  shortcutHighlightTimer,
  addressInputRef,
}: MenuShortcutsOptions) {
  useEffect(() => {
    if (!menuVisible || view !== 'menu' || !preferences) return;
    /** Handles the category shortcut. */
    const handleCategoryShortcut = (event: KeyboardEvent) => {
      // This listener runs in the capture phase, before the address input's
      // own key handler. Check the event target directly instead of waiting
      // for the asynchronous Main-process editable-focus report.
      if (isEditableKeyboardTarget(event.target)) return;
      const target = groups.find(([category], index) => {
        const shortcut =
          preferences.shortcuts[getMenuCategoryShortcutId(category)] ??
          getDefaultMenuCategoryShortcut(index);
        return matchesKeyboardAccelerator(event, shortcut);
      });
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const category = target[0];
      categoryElements.current.get(category)?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      setShortcutTargetCategory(category);
      if (shortcutHighlightTimer.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimer.current);
      }
      shortcutHighlightTimer.current = window.setTimeout(() => {
        shortcutHighlightTimer.current = undefined;
        setShortcutTargetCategory(undefined);
      }, AUTO_HIDE_SCROLLBAR_DELAY_MS);
    };
    window.addEventListener('keydown', handleCategoryShortcut, true);
    return () => window.removeEventListener('keydown', handleCategoryShortcut, true);
  }, [groups, menuVisible, preferences, reduceMotion, view]);

  useEffect(() => {
    if (!menuVisible || view !== 'menu') return;
    /** Performs the focus address operation. */
    const focusAddress = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'l' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    };
    window.addEventListener('keydown', focusAddress, true);
    return () => window.removeEventListener('keydown', focusAddress, true);
  }, [menuVisible, view]);
}
