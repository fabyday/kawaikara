/** Describes the shared video icon props contract. */
interface VideoIconProps {
  /** The optional class name. */
  readonly className?: string;
}

/** Renders the video playback-state icon. */
export function PlaybackIcon({
  playing,
  className,
}: VideoIconProps & {
  /** Whether playback is currently active. */
  readonly playing: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 24 24"
    >
      {playing ? (
        <>
          <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
          <rect x="14" y="5" width="3.5" height="14" rx="1" />
        </>
      ) : (
        <path d="M8 5.8v12.4c0 .8.9 1.3 1.6.9l9.1-6.2a1.05 1.05 0 0 0 0-1.8L9.6 4.9A1.04 1.04 0 0 0 8 5.8Z" />
      )}
    </svg>
  );
}

/** Renders the restore-window icon. */
export function RestoreWindowIcon({ className }: VideoIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M9 5H5v14h14v-4" />
      <path d="M11 5h8v8" />
      <path d="m19 5-9 9" />
    </svg>
  );
}

/** Renders the video-library home icon. */
export function VideoHomeIcon({ className }: VideoIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.5 9.2V20h13V9.2" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

/** Renders the parent-directory icon. */
export function VideoUpIcon({ className }: VideoIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.1"
      viewBox="0 0 24 24"
    >
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

/** Renders the video-library search icon. */
export function VideoSearchIcon({ className }: VideoIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

/** Renders the close icon used by a video overlay. */
export function VideoCloseIcon({ className }: VideoIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6.5 6.5 11 11" />
      <path d="m17.5 6.5-11 11" />
    </svg>
  );
}
