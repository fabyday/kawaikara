import type {
  AppMessages,
  PreferenceState
} from '../../../../Common/IPC';

/** Performs the app locale options operation. */
export function appLocaleOptions(messages: AppMessages) {
  return [
    {
      /** The label value. */
      label: messages.system,
      /** The value value. */
      value: 'system',
    },
    {
      /** The label value. */
      label: messages.korean,
      /** The value value. */
      value: 'ko-KR',
    },
    {
      /** The label value. */
      label: messages.english,
      /** The value value. */
      value: 'en-US',
    },
    {
      /** The label value. */
      label: messages.japanese,
      /** The value value. */
      value: 'ja-JP',
    },
  ];
}

/** Performs the app theme options operation. */
export function appThemeOptions(messages: AppMessages) {
  return [
    {
      /** The label value. */
      label: messages.darkTheme,
      /** The value value. */
      value: 'dark',
    },
    {
      /** The label value. */
      label: messages.lightTheme,
      /** The value value. */
      value: 'light',
    },
  ];
}

/** Performs the dev tools mode options operation. */
export function devToolsModeOptions(messages: AppMessages) {
  return [
    {
      /** The label value. */
      label: messages.devToolsPlacementDetach,
      /** The value value. */
      value: 'detach',
    },
    {
      /** The label value. */
      label: messages.devToolsPlacementUndocked,
      /** The value value. */
      value: 'undocked',
    },
    {
      /** The label value. */
      label: messages.devToolsPlacementRight,
      /** The value value. */
      value: 'right',
    },
    {
      /** The label value. */
      label: messages.devToolsPlacementBottom,
      /** The value value. */
      value: 'bottom',
    },
    {
      /** The label value. */
      label: messages.devToolsPlacementLeft,
      /** The value value. */
      value: 'left',
    },
  ];
}

/** Performs the preferences equal operation. */
export function preferencesEqual(
  left: PreferenceState,
  right: PreferenceState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
