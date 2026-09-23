import {
  Panel,
  Stack,
  Switch,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  PreferencePatch,
  PreferenceState,
} from '../../../../Common/IPC';
import {
  MAX_KAWAI_SHORTCUT_DELAY_SECONDS,
  MIN_KAWAI_SHORTCUT_DELAY_SECONDS,
} from '../../../../Common/KawaiShortcut';
import { NumberInput } from '../NumberInput';

/** Renders advanced application behavior preferences. */
export function AdvancedTab({
  messages,
  preferences,
  saving,
  onUpdate,
}: {
  /** Localized application messages. */
  readonly messages: AppMessages;
  /** Current preference draft. */
  readonly preferences: PreferenceState;
  /** Whether preferences are being saved. */
  readonly saving: boolean;
  /** Updates the preference draft. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  return (
    <Stack gap="lg">
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
          <NumberInput
            disabled={saving || !preferences.kawaiShortcutEnabled}
            label={messages.kawaiShortcutDelay}
            live
            max={MAX_KAWAI_SHORTCUT_DELAY_SECONDS}
            min={MIN_KAWAI_SHORTCUT_DELAY_SECONDS}
            step={0.1}
            unit={messages.seconds}
            value={preferences.kawaiShortcutDelaySeconds}
            description={messages.kawaiShortcutDelayDescription}
            onValueChange={(kawaiShortcutDelaySeconds) => onUpdate({
              kawaiShortcutDelaySeconds,
            })}
          />
        </Stack>
      </section>
    </Stack>
  );
}
