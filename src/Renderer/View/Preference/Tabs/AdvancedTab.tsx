import {
  Panel,
  Stack,
  Switch,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  ApplicationDataLocation,
  PreferencePatch,
  PreferenceState,
} from '../../../../Common/IPC';
import {
  MAX_KAWAI_SHORTCUT_DELAY_SECONDS,
  MIN_KAWAI_SHORTCUT_DELAY_SECONDS,
} from '../../../../Common/KawaiShortcut';
import { NumberInput } from '../NumberInput';
import { AppDataLocationControl } from './AppDataLocationControl';

/** Renders advanced application behavior preferences. */
export function AdvancedTab({
  messages,
  preferences,
  saving,
  onUpdate,
  dataLocation,
  onSavePreferences,
}: {
  /** Localized application messages. */
  readonly messages: AppMessages;
  /** Current preference draft. */
  readonly preferences: PreferenceState;
  /** Whether preferences are being saved. */
  readonly saving: boolean;
  /** Updates the preference draft. */
  readonly onUpdate: (patch: PreferencePatch) => void;
  /** Windows-only capability returned by Main. */
  readonly dataLocation?: ApplicationDataLocation;
  /** Saves ordinary preferences before changing the next-launch data root. */
  readonly onSavePreferences?: () => Promise<PreferenceState | undefined>;
}) {
  return (
    <Stack gap="lg">
      {dataLocation && onSavePreferences ? <AppDataLocationControl location={dataLocation} messages={messages.appDataLocation}
        locale={preferences.appLocale} saving={saving} onSavePreferences={onSavePreferences} /> : null}
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.kawaiShortcut}
        </Text>
        <Stack gap="sm">
          <Panel className="advanced-setting-card" padding="md" radius="md">
            <Switch
              checked={preferences.kawaiShortcutEnabled}
              disabled={saving}
              label={messages.kawaiShortcut}
              description={messages.kawaiShortcutDescription}
              onCheckedChange={(kawaiShortcutEnabled) => onUpdate({
                kawaiShortcutEnabled,
              })}
            />
          </Panel>
          <Panel className="advanced-setting-card" padding="md" radius="md">
            <Stack gap="md">
              <Switch
                checked={preferences.kawaiShortcutUnlimitedWait}
                disabled={saving || !preferences.kawaiShortcutEnabled}
                label={messages.kawaiShortcutUnlimitedWait}
                description={messages.kawaiShortcutUnlimitedWaitDescription}
                onCheckedChange={(kawaiShortcutUnlimitedWait) => onUpdate({ kawaiShortcutUnlimitedWait })}
              />
              <NumberInput
                disabled={saving || !preferences.kawaiShortcutEnabled || preferences.kawaiShortcutUnlimitedWait}
                label={messages.kawaiShortcutDelay}
                live
                max={MAX_KAWAI_SHORTCUT_DELAY_SECONDS}
                min={MIN_KAWAI_SHORTCUT_DELAY_SECONDS}
                step={0.1}
                unit={messages.seconds}
                value={preferences.kawaiShortcutDelaySeconds}
                description={messages.kawaiShortcutDelayDescription}
                onValueChange={(kawaiShortcutDelaySeconds) => onUpdate({ kawaiShortcutDelaySeconds })}
              />
            </Stack>
          </Panel>
        </Stack>
      </section>
    </Stack>
  );
}
