/** Describes the right arrow icon props contract. */
export interface RightArrowIconProps {
  /** The class name value. */
  readonly className?: string;
}

/** Renders a rounded, forward-facing action arrow. */
export function RightArrowIcon({ className }: RightArrowIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13M14 7.5l4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
