import {
  useMemo
} from 'react';
import { APP_SHORTCUTS } from '../../../../Common/AppShortcuts';
import {
  SHORT_FORM_VIDEO_SHORTCUTS,
} from '../../../../Common/ShortFormVideo';
import {
  VIDEO_SHORTCUTS
} from '../../../../Common/VideoControls';
import {
  createOrderedSiteGroups,
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId
} from '../../../Domain/MenuOrder';
import { resolveProviderText } from '../Logic/ProviderSettings';
import { findDuplicateShortcutIds } from '../Shortcuts/ShortcutBindings';
import { PreferenceViewProps, ShortcutItem } from '../Types';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by useShortcutItems. */
type ShortcutItemsOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'messages'
  | 'draftPreferences'
> & Pick<PreferenceViewProps,
  | 'sites'
>;

/** Coordinates shortcut items behavior for this View. */
export function useShortcutItems({
  messages,
  sites,
  draftPreferences,
}: ShortcutItemsOptions) {
  const appShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      APP_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id],
      })),
    [messages],
  );

  const videoShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      VIDEO_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id],
      })),
    [messages],
  );

  const shortFormVideoShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      SHORT_FORM_VIDEO_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id],
      })),
    [messages],
  );

  const siteShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      sites.map((site) => ({
        id: `site:${site.id}`,
        title: site.title,
        defaultKey: site.defaultShortcut,
      })),
    [sites],
  );

  const providerShortcutItems = useMemo<ShortcutItem[]>(
    () => sites.flatMap((site) => site.actionShortcuts.map((shortcut) => ({
      id: shortcut.id,
      title: resolveProviderText(shortcut.title, draftPreferences?.appLocale ?? 'system'),
      description: shortcut.description
        ? resolveProviderText(shortcut.description, draftPreferences?.appLocale ?? 'system')
        : undefined,
      defaultKey: shortcut.defaultKey,
    }))),
    [draftPreferences?.appLocale, sites],
  );

  const categoryShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      createOrderedSiteGroups(sites, draftPreferences).map(
        ([category], index) => ({
          id: getMenuCategoryShortcutId(category),
          title: messages.categoryPosition.replace(
            '{number}',
            String(index + 1),
          ),
          description: `${messages.currentCategory}: ${messages.categoryLabels[category] ?? category}`,
          defaultKey: getDefaultMenuCategoryShortcut(index),
        }),
      ),
    [draftPreferences, messages, sites],
  );

  const allShortcutItems = useMemo(
    () => [
      ...appShortcutItems,
      ...videoShortcutItems,
      ...shortFormVideoShortcutItems,
      ...providerShortcutItems,
      ...categoryShortcutItems,
      ...siteShortcutItems,
    ],
    [
      appShortcutItems,
      categoryShortcutItems,
      providerShortcutItems,
      siteShortcutItems,
      shortFormVideoShortcutItems,
      videoShortcutItems,
    ],
  );

  const shortcutItemsById = useMemo(
    () => new Map(allShortcutItems.map((item) => [item.id, item])),
    [allShortcutItems],
  );

  const duplicateShortcutIds = useMemo(
    () =>
      draftPreferences
        ? findDuplicateShortcutIds(allShortcutItems, draftPreferences.shortcuts)
        : new Set<string>(),
    [allShortcutItems, draftPreferences],
  );

  return {
    /** The appShortcutItems value. */
    appShortcutItems,
    /** The videoShortcutItems value. */
    videoShortcutItems,
    /** The shortFormVideoShortcutItems value. */
    shortFormVideoShortcutItems,
    /** The siteShortcutItems value. */
    siteShortcutItems,
    /** The providerShortcutItems value. */
    providerShortcutItems,
    /** The categoryShortcutItems value. */
    categoryShortcutItems,
    /** The allShortcutItems value. */
    allShortcutItems,
    /** The shortcutItemsById value. */
    shortcutItemsById,
    /** The duplicateShortcutIds value. */
    duplicateShortcutIds,
  };
}
