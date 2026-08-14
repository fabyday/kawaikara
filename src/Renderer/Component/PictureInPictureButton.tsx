import { Button } from '@kawaikara/kawai-ui';

export interface PictureInPictureButtonProps {
  readonly active?: boolean;
  readonly isLoading?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly shortLabel?: string;
}

export function PictureInPictureButton({
  active = false,
  isLoading = false,
  label,
  onPress,
  shortLabel = 'PiP',
}: PictureInPictureButtonProps) {
  return (
    <Button
      className="overlay-pip-button"
      aria-label={label}
      aria-pressed={active}
      isLoading={isLoading}
      size="sm"
      title={label}
      variant={active ? 'primary' : 'secondary'}
      onClick={onPress}
    >
      {shortLabel}
    </Button>
  );
}
