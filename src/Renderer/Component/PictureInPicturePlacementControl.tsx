import { Flex, Select } from '@kawaikara/kawai-ui';
import type { DisplayInfo } from '../../Common/IPC';
import type {
  PictureInPictureMonitorMode,
  PictureInPicturePlacementPreference,
  PictureInPicturePosition,
} from '../../Common/PictureInPicture';

export interface PictureInPicturePlacementControlMessages {
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly currentDisplay: string;
  readonly display: string;
  readonly lastDisplay: string;
  readonly lastPosition: string;
  readonly monitor: string;
  readonly monitorDescription: string;
  readonly position: string;
  readonly positionDescription: string;
  readonly primary: string;
  readonly topLeft: string;
  readonly topRight: string;
  readonly unavailableDisplay: string;
  readonly videoDisplay: string;
}

export interface PictureInPicturePlacementControlProps {
  readonly disabled?: boolean;
  readonly displays: readonly DisplayInfo[];
  readonly messages: PictureInPicturePlacementControlMessages;
  readonly value: PictureInPicturePlacementPreference;
  readonly onChange: (value: PictureInPicturePlacementPreference) => void;
}

export function PictureInPicturePlacementControl({
  disabled = false,
  displays,
  messages,
  value,
  onChange,
}: PictureInPicturePlacementControlProps) {
  const monitorValue =
    value.monitor.mode === 'display' && value.monitor.displayId
      ? `display:${value.monitor.displayId}`
      : value.monitor.mode;
  const monitorOptions = [
    { label: messages.currentDisplay, value: 'current' },
    { label: messages.videoDisplay, value: 'video' },
    { label: messages.lastDisplay, value: 'last' },
    ...displays.map((display, index) => ({
      label: displayLabel(display, index, messages),
      value: `display:${display.id}`,
    })),
  ];
  if (
    value.monitor.mode === 'display' &&
    value.monitor.displayId &&
    !displays.some((display) => display.id === value.monitor.displayId)
  ) {
    monitorOptions.push({
      label: `${messages.unavailableDisplay} · ${value.monitor.displayId}`,
      value: monitorValue,
    });
  }

  return (
    <Flex direction="column" gap="sm">
      <Select
        disabled={disabled}
        label={messages.position}
        description={messages.positionDescription}
        options={positionOptions(messages)}
        value={value.position}
        onValueChange={(position) =>
          onChange({
            ...value,
            position: position as PictureInPicturePosition,
          })
        }
      />
      <Select
        disabled={disabled}
        label={messages.monitor}
        description={messages.monitorDescription}
        options={monitorOptions}
        value={monitorValue}
        onValueChange={(monitor) => {
          if (monitor.startsWith('display:')) {
            onChange({
              ...value,
              monitor: {
                mode: 'display',
                displayId: monitor.slice('display:'.length),
              },
            });
            return;
          }
          onChange({
            ...value,
            monitor: { mode: monitor as PictureInPictureMonitorMode },
          });
        }}
      />
    </Flex>
  );
}

function positionOptions(
  messages: PictureInPicturePlacementControlMessages,
): Array<{ label: string; value: PictureInPicturePosition }> {
  return [
    { label: messages.topLeft, value: 'top-left' },
    { label: messages.topRight, value: 'top-right' },
    { label: messages.bottomLeft, value: 'bottom-left' },
    { label: messages.bottomRight, value: 'bottom-right' },
    { label: messages.lastPosition, value: 'last' },
  ];
}

function displayLabel(
  display: DisplayInfo,
  index: number,
  messages: PictureInPicturePlacementControlMessages,
): string {
  const states = [
    display.primary ? messages.primary : '',
    display.current ? messages.currentDisplay : '',
  ].filter(Boolean);
  const suffix = states.length ? ` · ${states.join(', ')}` : '';
  return `${messages.display} ${String(index + 1)} · ${display.label} · ${String(display.width)} × ${String(display.height)}${suffix}`;
}
