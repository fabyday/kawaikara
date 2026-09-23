import { type ReactNode } from 'react';
import { formatAccelerator } from '../Domain/ShortcutAccelerator';

/** Renders an Electron accelerator as platform-native keycaps. */
export function ShortcutKeycaps({
  accelerator,
  className,
  emptyLabel,
}: {
  /** Electron accelerator to display. */
  readonly accelerator: string;
  /** Optional container class name. */
  readonly className?: string;
  /** Optional content displayed for an empty accelerator. */
  readonly emptyLabel?: ReactNode;
}) {
  const parts = formatAccelerator(accelerator);
  return (
    <div
      aria-hidden="true"
      className={['shortcut-key-group', className ?? ''].filter(Boolean).join(' ')}
    >
      {parts.length ? (
        parts.map((part, index) => (
          <span className="shortcut-key-part" key={`${part}-${String(index)}`}>
            <kbd>{part}</kbd>
            {index < parts.length - 1 ? <i>+</i> : null}
          </span>
        ))
      ) : emptyLabel ? (
        <span className="shortcut-empty">{emptyLabel}</span>
      ) : null}
    </div>
  );
}
