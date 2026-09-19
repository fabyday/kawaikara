import {
  RadioButton,
  RadioGroup,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';
import {
  MAX_VIDEO_SEEK_SECONDS,
  MIN_VIDEO_SEEK_SECONDS
} from '../../../../Common/VideoControls';
import { NumberInput } from '../../../Component/NumberInput';

/** Performs the video tab operation. */
export function VideoTab({
  messages,
  preferences,
  saving,
  onUpdate,
}: {
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}
) {
  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.video}
        </Text>
        <Stack gap="sm">
          <Text size="xs" tone="muted">
            {messages.videoSettingsDescription}
          </Text>
          <RadioGroup
            className="video-control-layout-options"
            disabled={saving}
            label={messages.videoControlsLayout}
            value={preferences.videoControlsLayout}
            onValueChange={(videoControlsLayout) =>
              onUpdate({
                videoControlsLayout:
                  videoControlsLayout === 'overlay' ? 'overlay' : 'inline',
              })
            }
          >
            <RadioButton
              description={messages.videoControlsInlineDescription}
              label={messages.videoControlsInline}
              value="inline"
            />
            <RadioButton
              description={messages.videoControlsOverlayDescription}
              label={messages.videoControlsOverlay}
              value="overlay"
            />
          </RadioGroup>
          <NumberInput
            disabled={saving}
            label={messages.videoSeekSeconds}
            max={MAX_VIDEO_SEEK_SECONDS}
            min={MIN_VIDEO_SEEK_SECONDS}
            step={1}
            unit={messages.seconds}
            value={preferences.videoSeekSeconds}
            description={messages.videoSeekSecondsDescription}
            onValueChange={(videoSeekSeconds) => onUpdate({
              videoSeekSeconds
            })}
          />
          <NumberInput
            disabled={saving || preferences.videoControlsLayout !== 'overlay'}
            label={messages.videoOverlayHideSeconds}
            max={30}
            min={0.5}
            step={0.1}
            unit={messages.seconds}
            value={preferences.videoOverlayHideSeconds}
            description={messages.videoOverlayHideSecondsDescription}
            onValueChange={(videoOverlayHideSeconds) =>
              onUpdate({
                videoOverlayHideSeconds
              })
            }
          />
        </Stack>
      </section>
    </Stack>
  );
}
