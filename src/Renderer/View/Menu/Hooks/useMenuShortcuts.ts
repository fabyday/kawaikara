import {
  useCallback,
  useEffect
} from 'react';
import {
  AUTO_HIDE_SCROLLBAR_DELAY_MS
} from '../../../Component/AutoHideScrollArea';
import {
  getKawaiShortcutIndex,
  MAX_KAWAI_SHORTCUT_SITES,
  validateKawaiShortcutDelaySeconds,
} from '../../../../Common/KawaiShortcut';
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
  | 'shortcutTargetCategory'
  | 'kawaiShortcutPage'
  | 'categoryElements'
  | 'reduceMotion'
  | 'setShortcutTargetCategory'
  | 'setKawaiShortcutPage'
  | 'shortcutHighlightTimer'
  | 'kawaiShortcutActiveRef'
  | 'addressInputRef'
> & {
  /** The groups value for this section. */
  readonly groups: SiteMenuGroup[];
  /** Opens the selected site. */
  readonly openSite: (id: string) => void | Promise<void>;
};

/** Coordinates menu shortcuts behavior for this View. */
export function useMenuShortcuts({
  menuVisible,
  view,
  preferences,
  shortcutTargetCategory,
  kawaiShortcutPage,
  groups,
  categoryElements,
  reduceMotion,
  setShortcutTargetCategory,
  setKawaiShortcutPage,
  shortcutHighlightTimer,
  kawaiShortcutActiveRef,
  addressInputRef,
  openSite,
}: MenuShortcutsOptions) {
  /** Clears the active category and its numeric site page. */
  const cancelKawaiShortcut = useCallback(() => {
    if (shortcutHighlightTimer.current !== undefined) {
      window.clearTimeout(shortcutHighlightTimer.current);
      shortcutHighlightTimer.current = undefined;
    }
    kawaiShortcutActiveRef.current = false;
    setKawaiShortcutPage(0);
    setShortcutTargetCategory(undefined);
  }, []);

  /** Restarts the highlight and site-selection deadline. */
  const restartShortcutTimer = useCallback(() => {
    if (!preferences) return;
    if (shortcutHighlightTimer.current !== undefined) {
      window.clearTimeout(shortcutHighlightTimer.current);
    }
    shortcutHighlightTimer.current = window.setTimeout(() => {
      shortcutHighlightTimer.current = undefined;
      kawaiShortcutActiveRef.current = false;
      setKawaiShortcutPage(0);
      setShortcutTargetCategory(undefined);
    }, preferences.kawaiShortcutEnabled
      ? validateKawaiShortcutDelaySeconds(
        preferences.kawaiShortcutDelaySeconds,
      ) * 1_000
      : AUTO_HIDE_SCROLLBAR_DELAY_MS);
  }, [preferences]);

  /** Moves the active category to an adjacent ten-site page. */
  const moveKawaiShortcutPage = useCallback((direction: -1 | 1) => {
    if (!preferences?.kawaiShortcutEnabled || !shortcutTargetCategory) return;
    const activeGroup = groups.find(
      ([category]) => category === shortcutTargetCategory,
    );
    if (!activeGroup) return;
    const pageCount = Math.max(
      1,
      Math.ceil(activeGroup[1].length / MAX_KAWAI_SHORTCUT_SITES),
    );
    const nextPage = Math.min(
      pageCount - 1,
      Math.max(0, kawaiShortcutPage + direction),
    );
    if (nextPage !== kawaiShortcutPage) {
      setKawaiShortcutPage(nextPage);
      const targetPage = categoryElements.current
        .get(activeGroup[0])
        ?.querySelector<HTMLElement>(
          `[data-kawai-shortcut-page="${String(nextPage)}"]`,
        );
      /** Scrolls the next selection panel beneath the sticky category header. */
      const scrollToTargetPage = () => targetPage?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      if (reduceMotion) {
        scrollToTargetPage();
      } else {
        const scrollArea = targetPage?.closest<HTMLElement>('.site-list');
        scrollArea?.scrollTo({
          behavior: 'auto',
          top: scrollArea.scrollTop,
        });
        window.requestAnimationFrame(scrollToTargetPage);
      }
    }
    restartShortcutTimer();
  }, [
    groups,
    kawaiShortcutPage,
    preferences,
    reduceMotion,
    restartShortcutTimer,
    shortcutTargetCategory,
  ]);

  useEffect(() => {
    if (!menuVisible || view !== 'menu' || !preferences) {
      kawaiShortcutActiveRef.current = false;
      if (shortcutHighlightTimer.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimer.current);
        shortcutHighlightTimer.current = undefined;
      }
      if (shortcutTargetCategory !== undefined) {
        setShortcutTargetCategory(undefined);
      }
      if (kawaiShortcutPage !== 0) setKawaiShortcutPage(0);
      return;
    }
    /** Handles the category shortcut. */
    const handleCategoryShortcut = (event: KeyboardEvent) => {
      // This listener runs in the capture phase, before the address input's
      // own key handler. Check the event target directly instead of waiting
      // for the asynchronous Main-process editable-focus report.
      if (
        isEditableKeyboardTarget(event.target) ||
        event.repeat ||
        event.isComposing
      ) return;

      const activeGroup = shortcutTargetCategory === undefined
        ? undefined
        : groups.find(([category]) => category === shortcutTargetCategory);
      if (preferences.kawaiShortcutEnabled && activeGroup) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelKawaiShortcut();
          return;
        }
        const pageDirection = event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowLeft'
            ? -1
            : 0;
        if (pageDirection !== 0) {
          event.preventDefault();
          event.stopImmediatePropagation();
          moveKawaiShortcutPage(pageDirection);
          return;
        }
        const unmodified = !event.ctrlKey && !event.metaKey &&
          !event.altKey && !event.shiftKey;
        const siteIndex = unmodified
          ? getKawaiShortcutIndex(event.key)
          : undefined;
        if (siteIndex !== undefined) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const site = activeGroup[1][
            (kawaiShortcutPage * MAX_KAWAI_SHORTCUT_SITES) + siteIndex
          ];
          cancelKawaiShortcut();
          if (site) void openSite(site.id);
          return;
        }
      }

      const target = groups.find(([category], index) => {
        const shortcut =
          preferences.shortcuts[getMenuCategoryShortcutId(category)] ??
          getDefaultMenuCategoryShortcut(index);
        return matchesKeyboardAccelerator(event, shortcut);
      });
      if (!target) {
        if (
          preferences.kawaiShortcutEnabled &&
          activeGroup &&
          !['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)
        ) {
          cancelKawaiShortcut();
        }
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const category = target[0];
      categoryElements.current.get(category)?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      setKawaiShortcutPage(0);
      setShortcutTargetCategory(category);
      kawaiShortcutActiveRef.current = preferences.kawaiShortcutEnabled;
      restartShortcutTimer();
    };
    window.addEventListener('keydown', handleCategoryShortcut, true);
    return () => window.removeEventListener('keydown', handleCategoryShortcut, true);
  }, [
    groups,
    kawaiShortcutPage,
    menuVisible,
    moveKawaiShortcutPage,
    openSite,
    preferences,
    restartShortcutTimer,
    shortcutTargetCategory,
    view,
  ]);

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

  return {
    /** Moves the current Kawai Shortcut selection page. */
    moveKawaiShortcutPage,
  };
}
