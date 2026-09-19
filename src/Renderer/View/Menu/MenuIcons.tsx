

/** Copies the icon. */
export function CopyIcon() {
  return (
    <svg aria-hidden="true" className="menu-address-action-icon" viewBox="0 0 24 24">
      <rect height="11" rx="2" width="11" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Performs the check icon operation. */
export function CheckIcon() {
  return (
    <svg aria-hidden="true" className="menu-address-action-icon" viewBox="0 0 24 24">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

/** Performs the always on top icon operation. */
export function AlwaysOnTopIcon() {
  return (
    <svg className="always-on-top-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4h8l-1.2 5 2.7 2.7v1.8H6.5v-1.8L9.2 9 8 4Z" />
      <path d="M12 13.5V21" />
    </svg>
  );
}
