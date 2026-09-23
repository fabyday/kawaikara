import { NumberInput } from './NumberInput';
import { PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS } from '../../../Common/PictureInPicture';

/** Shared percentage-based typography preference control. */
export interface SubtitleScaleControlProps {
  /** Accessible setting title. */
  readonly label: string;
  /** Explain the scope and original-size default. */
  readonly description: string;
  /** Localized supported-range warning; {min}/{max} come from the shared limits. */
  readonly rangeMessage: string;
  /** Absolute font multiplier, not a pixel size. */
  readonly value: number;
  /** Disable while preferences are saving. */
  readonly disabled?: boolean;
  /** Persist the next absolute font multiplier. */
  readonly onChange: (scale: number) => void;
}

/** Reuse the existing numeric input's validation and keyboard accessibility. */
export function SubtitleScaleControl({ label, description, rangeMessage, value, disabled, onChange }: SubtitleScaleControlProps) {
  return (
    <NumberInput
      label={label}
      description={description}
      live
      rangeMessage={rangeMessage
        .replaceAll('{min}', String(PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS.min * 100))
        .replaceAll('{max}', String(PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS.max * 100))}
      disabled={disabled}
      value={Math.round(value * 100)}
      min={PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS.min * 100}
      max={PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS.max * 100}
      step={PICTURE_IN_PICTURE_SUBTITLE_SCALE_LIMITS.step * 100}
      unit="%"
      onValueChange={(percent) => onChange(percent / 100)}
    />
  );
}
