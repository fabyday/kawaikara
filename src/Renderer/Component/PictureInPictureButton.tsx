import { Button } from '@kawaikara/kawai-ui';

/** Describes the picture in picture button props contract. */
export interface PictureInPictureButtonProps {
  /** Whether the active option is enabled. */
  readonly active?: boolean;
  /** The failure key value. */
  readonly failureKey?: number;
  /** Whether the loading option is enabled. */
  readonly isLoading?: boolean;
  /** The label value. */
  readonly label: string;
  /** Callback used to handle on press. */
  readonly onPress: () => void;
  /** The short label value. */
  readonly shortLabel?: string;
}

/** Performs the picture in picture button operation. */
export function PictureInPictureButton({
  active = false,
  failureKey = 0,
  isLoading = false,
  label,
  onPress,
  shortLabel = 'PiP',
}: PictureInPictureButtonProps) {
  return (
    <Button
      className={`overlay-pip-button${failureKey > 0 ? ' is-unavailable' : ''}`}
      key={failureKey}
      aria-label={label}
      aria-pressed={active}
      isLoading={isLoading}
      size="icon"
      title={label}
      variant={active ? 'primary' : 'secondary'}
      onClick={onPress}
    >
      <PictureInPictureIcon />
      <span className="visually-hidden">{shortLabel}</span>
    </Button>
  );
}

/** Performs the picture in picture icon operation. */
function PictureInPictureIcon() {
  return (
    <svg aria-hidden="true" className="overlay-pip-icon" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <rect x="11" y="11" width="7" height="5" rx="1" />
    </svg>
  );
}
