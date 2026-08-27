import { AnimatePresence, motion } from 'motion/react';
import { Flex, Select } from '@kawaikara/kawai-ui';
import { NumberInput } from './NumberInput';
import {
  PICTURE_IN_PICTURE_SIZE_LIMITS,
  PICTURE_IN_PICTURE_SIZE_PRESETS,
  type PictureInPictureSizePreference,
  type PictureInPictureSizePreset,
} from '../../Common/PictureInPicture';

/** Describes the picture in picture size control messages contract. */
export interface PictureInPictureSizeControlMessages {
  /** The compact value. */
  readonly compact: string;
  /** The custom value. */
  readonly custom: string;
  /** The description value. */
  readonly description: string;
  /** The height value. */
  readonly height: string;
  /** The large value. */
  readonly large: string;
  /** The medium value. */
  readonly medium: string;
  /** The pixels value. */
  readonly pixels: string;
  /** The size value. */
  readonly size: string;
  /** The width value. */
  readonly width: string;
}

/** Describes the picture in picture size control props contract. */
export interface PictureInPictureSizeControlProps {
  /** Whether the disabled option is enabled. */
  readonly disabled?: boolean;
  /** The limits value. */
  readonly limits?: {
    /** The max height value. */
    readonly maxHeight: number;
    /** The max width value. */
    readonly maxWidth: number;
    /** The min height value. */
    readonly minHeight: number;
    /** The min width value. */
    readonly minWidth: number;
  };
  /** The messages value. */
  readonly messages: PictureInPictureSizeControlMessages;
  /** The presets value. */
  readonly presets?: Readonly<
    Record<
      Exclude<PictureInPictureSizePreset, 'custom'>,
      {
        /** The height value. */
        readonly height: number;
        /** The width value. */
        readonly width: number;
      }
    >
  >;
  /** The value value. */
  readonly value: PictureInPictureSizePreference;
  /** Callback used to handle on change. */
  readonly onChange: (value: PictureInPictureSizePreference) => void;
}

/** Performs the picture in picture size control operation. */
export function PictureInPictureSizeControl({
  disabled = false,
  limits = PICTURE_IN_PICTURE_SIZE_LIMITS,
  messages,
  presets = PICTURE_IN_PICTURE_SIZE_PRESETS,
  value,
  onChange,
}: PictureInPictureSizeControlProps) {
  const options: Array<{ label: string; value: PictureInPictureSizePreset
  }> = (
    Object.entries(presets) as Array<
      [
        Exclude<PictureInPictureSizePreset, 'custom'>,
        { width: number; height: number
        },
      ]
    >
  ).map(([preset, size]) => ({
    label: `${presetLabel(preset, messages)} · ${String(size.width)} × ${String(size.height)}`,
    value: preset,
  }));
  options.push({ label: messages.custom, value: 'custom'
  });

  return (
    <Flex direction="column" gap="sm">
      <Select
        disabled={disabled}
        label={messages.size}
        options={options}
        value={value.preset}
        description={messages.description}
        onValueChange={(preset) =>
          onChange({ ...value, preset: preset as PictureInPictureSizePreset
          })
        }
      />
      <AnimatePresence initial={false}>
        {value.preset === 'custom' ? (
          <motion.div
            className="pip-custom-size-fields"
            initial={{ height: 0, opacity: 0, y: -8
            }}
            animate={{ height: 'auto', opacity: 1, y: 0
            }}
            exit={{ height: 0, opacity: 0, y: -8
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 34
            }}
          >
            <div className="pip-custom-size-grid">
              <NumberInput
                containerClassName="pip-dimension-field"
                disabled={disabled}
                label={messages.width}
                layout="stacked"
                max={limits.maxWidth}
                min={limits.minWidth}
                step={1}
                unit={messages.pixels}
                value={value.width}
                onValueChange={(width) =>
                  onChange({ ...value, width
                  })
                }
              />
              <NumberInput
                containerClassName="pip-dimension-field"
                disabled={disabled}
                label={messages.height}
                layout="stacked"
                max={limits.maxHeight}
                min={limits.minHeight}
                step={1}
                unit={messages.pixels}
                value={value.height}
                onValueChange={(height) =>
                  onChange({ ...value, height
                  })
                }
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Flex>
  );
}

/** Performs the preset label operation. */
function presetLabel(
  preset: Exclude<PictureInPictureSizePreset, 'custom'>,
  messages: PictureInPictureSizeControlMessages,
): string {
  return {
    compact: messages.compact,
    medium: messages.medium,
    large: messages.large,
  }[preset];
}
