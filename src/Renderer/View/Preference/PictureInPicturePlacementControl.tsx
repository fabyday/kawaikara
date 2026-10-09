import { Flex, Select, Switch } from '@kawaikara/kawai-ui';
import type { DisplayInfo } from '../../../Common/IPC';
import type {
  PictureInPictureMonitorMode,
  PictureInPicturePlacementPreference,
  PictureInPicturePosition,
} from '../../../Common/PictureInPicture';

/** Describes the picture in picture placement control messages contract. */
export interface PictureInPicturePlacementControlMessages {
  /** The bottom left value. */
  readonly bottomLeft: string;
  /** The bottom right value. */
  readonly bottomRight: string;
  /** The current display value. */
  readonly currentDisplay: string;
  /** The display value. */
  readonly display: string;
  /** The last display value. */
  readonly lastDisplay: string;
  /** The last position value. */
  readonly lastPosition: string;
  /** The monitor value. */
  readonly monitor: string;
  /** The monitor description value. */
  readonly monitorDescription: string;
  /** The position value. */
  readonly position: string;
  /** The position description value. */
  readonly positionDescription: string;
  /** The primary value. */
  readonly primary: string;
  /** The top left value. */
  readonly topLeft: string;
  /** The top right value. */
  readonly topRight: string;
  /** The automatic alignment toggle label. */
  readonly align: string;
  /** Explains snapping after a drag. */
  readonly alignDescription: string;
}

/** Describes the picture in picture placement control props contract. */
export interface PictureInPicturePlacementControlProps {
  /** Whether the disabled option is enabled. */
  readonly disabled?: boolean;
  /** The displays value. */
  readonly displays: readonly DisplayInfo[];
  /** The messages value. */
  readonly messages: PictureInPicturePlacementControlMessages;
  /** The value value. */
  readonly value: PictureInPicturePlacementPreference;
  /** Callback used to handle on change. */
  readonly onChange: (value: PictureInPicturePlacementPreference) => void;
}

/** Performs the picture in picture placement control operation. */
export function PictureInPicturePlacementControl({
  disabled = false,
  displays,
  messages,
  value,
  onChange,
}: PictureInPicturePlacementControlProps) {
  const monitorValue =
    value.monitor.mode === 'display' && value.monitor.displayId
      ? displays.some(display => display.id === value.monitor.displayId)
        ? `display:${value.monitor.displayId}` : 'current'
      : value.monitor.mode;
  const monitorOptions = [
    { label: messages.currentDisplay, value: 'current'
    },
    { label: messages.lastPosition, value: 'last-position'
    },
    { label: messages.lastDisplay, value: 'last'
    },
    { label: messages.primary, value: 'primary' },
    ...displays.map((display, index) => ({
      label: displayLabel(display, index, messages),
      value: `display:${display.id}`,
    })),
  ];

  return (
    <Flex className="pip-placement-control" direction="column" gap="sm">
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
      <Switch
        checked={value.align === true}
        disabled={disabled}
        label={messages.align}
        description={messages.alignDescription}
        onCheckedChange={(align) => onChange({ ...value, align })}
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
            monitor: { mode: monitor as PictureInPictureMonitorMode
            },
          });
        }}
      />
    </Flex>
  );
}

/** Performs the position options operation. */
function positionOptions(
  messages: PictureInPicturePlacementControlMessages,
): Array<{
  /** The label value. */
  label: string;
  /** The value value. */
  value: PictureInPicturePosition;
}> {
  return [
    {
      /** The label value. */
      label: messages.topLeft,
      /** The value value. */
      value: 'top-left',
    },
    {
      /** The label value. */
      label: messages.topRight,
      /** The value value. */
      value: 'top-right',
    },
    {
      /** The label value. */
      label: messages.bottomLeft,
      /** The value value. */
      value: 'bottom-left',
    },
    {
      /** The label value. */
      label: messages.bottomRight,
      /** The value value. */
      value: 'bottom-right',
    },
  ];
}

/** Performs the display label operation. */
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
