import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flex, Select } from '@kawaikara/kawai-ui';
import {
  PICTURE_IN_PICTURE_SIZE_LIMITS,
  PICTURE_IN_PICTURE_SIZE_PRESETS,
  type PictureInPictureSizePreference,
  type PictureInPictureSizePreset,
} from '../../Common/PictureInPicture';

export interface PictureInPictureSizeControlMessages {
  readonly compact: string;
  readonly custom: string;
  readonly description: string;
  readonly height: string;
  readonly large: string;
  readonly medium: string;
  readonly pixels: string;
  readonly size: string;
  readonly width: string;
}

export interface PictureInPictureSizeControlProps {
  readonly disabled?: boolean;
  readonly limits?: {
    readonly maxHeight: number;
    readonly maxWidth: number;
    readonly minHeight: number;
    readonly minWidth: number;
  };
  readonly messages: PictureInPictureSizeControlMessages;
  readonly presets?: Readonly<
    Record<
      Exclude<PictureInPictureSizePreset, 'custom'>,
      { readonly height: number; readonly width: number }
    >
  >;
  readonly value: PictureInPictureSizePreference;
  readonly onChange: (value: PictureInPictureSizePreference) => void;
}

export function PictureInPictureSizeControl({
  disabled = false,
  limits = PICTURE_IN_PICTURE_SIZE_LIMITS,
  messages,
  presets = PICTURE_IN_PICTURE_SIZE_PRESETS,
  value,
  onChange,
}: PictureInPictureSizeControlProps) {
  const [widthDraft, setWidthDraft] = useState(String(value.width));
  const [heightDraft, setHeightDraft] = useState(String(value.height));

  useEffect(() => setWidthDraft(String(value.width)), [value.width]);
  useEffect(() => setHeightDraft(String(value.height)), [value.height]);

  const options: Array<{ label: string; value: PictureInPictureSizePreset }> = (
    Object.entries(presets) as Array<
      [
        Exclude<PictureInPictureSizePreset, 'custom'>,
        { width: number; height: number },
      ]
    >
  ).map(([preset, size]) => ({
    label: `${presetLabel(preset, messages)} · ${String(size.width)} × ${String(size.height)}`,
    value: preset,
  }));
  options.push({ label: messages.custom, value: 'custom' });

  const updateDimension = (
    dimension: 'width' | 'height',
    rawValue: string,
  ) => {
    const setDraft = dimension === 'width' ? setWidthDraft : setHeightDraft;
    setDraft(rawValue);
    const number = Number(rawValue);
    const minimum =
      dimension === 'width'
        ? limits.minWidth
        : limits.minHeight;
    const maximum =
      dimension === 'width'
        ? limits.maxWidth
        : limits.maxHeight;
    if (!Number.isFinite(number) || number < minimum || number > maximum) return;
    onChange({ ...value, [dimension]: Math.round(number) });
  };

  const commitDimension = (
    dimension: 'width' | 'height',
    rawValue: string,
  ) => {
    const minimum =
      dimension === 'width'
        ? limits.minWidth
        : limits.minHeight;
    const maximum =
      dimension === 'width'
        ? limits.maxWidth
        : limits.maxHeight;
    const fallback = value[dimension];
    const parsed = Number(rawValue);
    const next = Number.isFinite(parsed)
      ? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
      : fallback;
    if (dimension === 'width') setWidthDraft(String(next));
    else setHeightDraft(String(next));
    onChange({ ...value, [dimension]: next });
  };

  return (
    <Flex direction="column" gap="sm">
      <Select
        disabled={disabled}
        label={messages.size}
        options={options}
        value={value.preset}
        description={messages.description}
        onValueChange={(preset) =>
          onChange({ ...value, preset: preset as PictureInPictureSizePreset })
        }
      />
      <AnimatePresence initial={false}>
        {value.preset === 'custom' ? (
          <motion.div
            className="pip-custom-size-fields"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="pip-custom-size-grid">
              <PictureInPictureDimensionField
                disabled={disabled}
                label={messages.width}
                max={limits.maxWidth}
                min={limits.minWidth}
                unit={messages.pixels}
                value={widthDraft}
                onChange={(next) => updateDimension('width', next)}
                onCommit={(next) => commitDimension('width', next)}
                onStep={(delta) =>
                  commitDimension('width', String(value.width + delta))
                }
              />
              <PictureInPictureDimensionField
                disabled={disabled}
                label={messages.height}
                max={limits.maxHeight}
                min={limits.minHeight}
                unit={messages.pixels}
                value={heightDraft}
                onChange={(next) => updateDimension('height', next)}
                onCommit={(next) => commitDimension('height', next)}
                onStep={(delta) =>
                  commitDimension('height', String(value.height + delta))
                }
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Flex>
  );
}

function PictureInPictureDimensionField({
  disabled,
  label,
  max,
  min,
  unit,
  value,
  onChange,
  onCommit,
  onStep,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly unit: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onCommit: (value: string) => void;
  readonly onStep: (delta: number) => void;
}) {
  const numericValue = Number(value);

  return (
    <label className="pip-dimension-field">
      <span className="pip-dimension-label">{label}</span>
      <span className="pip-dimension-value">
        <span className="number-preference-input-group">
          <input
            aria-label={label}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            value={value}
            onBlur={(event) => onCommit(event.currentTarget.value)}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (/^\d*$/.test(next)) onChange(next);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span className="number-preference-steppers">
            <button
              aria-label={`${label} +`}
              disabled={disabled || numericValue >= max}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onStep(1)}
            >
              +
            </button>
            <button
              aria-label={`${label} −`}
              disabled={disabled || numericValue <= min}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onStep(-1)}
            >
              −
            </button>
          </span>
        </span>
        <span className="number-preference-unit">{unit}</span>
      </span>
    </label>
  );
}

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
