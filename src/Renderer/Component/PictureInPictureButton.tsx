import { Button } from '@kawaikara/kawai-ui';

export interface PictureInPictureButtonProps {
  readonly active?: boolean;
  readonly failureKey?: number;
  readonly isLoading?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly shortLabel?: string;
}

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

function PictureInPictureIcon() {
  return (
    <svg aria-hidden="true" className="overlay-pip-icon" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <rect x="11" y="11" width="7" height="5" rx="1" />
    </svg>
  );
}
