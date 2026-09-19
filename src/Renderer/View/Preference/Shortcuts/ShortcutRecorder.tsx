import {
  useState,
  type KeyboardEvent
} from 'react';
import { createAccelerator, formatAccelerator, isModifierKey } from './ShortcutBindings';

/** Performs the shortcut recorder operation. */
export function ShortcutRecorder({
  disabled,
  emptyLabel,
  label,
  value,
  onChange,
}: {
  /** Whether the disabled option is enabled. */
  readonly disabled: boolean;
  /** The empty label value. */
  readonly emptyLabel: string;
  /** The label value. */
  readonly label: string;
  /** The value value. */
  readonly value: string;
  /** Callback used to handle on change. */
  readonly onChange: (value: string) => void;
}
) {
  const [preview, setPreview] = useState<string>();
  const displayValue = preview ?? value;
  const parts = formatAccelerator(displayValue);

  /** Handles the key down. */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      setPreview('');
      onChange('');
      return;
    }

    const accelerator = createAccelerator(event);
    setPreview(accelerator);
    if (!isModifierKey(event.key) && accelerator) onChange(accelerator);
  };

  /** Handles the key up. */
  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isModifierKey(event.key)) {
      const modifierPreview = createAccelerator(event);
      setPreview(modifierPreview || undefined);
    }
  };

  return (
    <div className="shortcut-recorder">
      <input
        aria-label={label}
        disabled={disabled}
        readOnly
        value={displayValue}
        onBlur={() => setPreview(undefined)}
        onFocus={() => setPreview(value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
      <div aria-hidden="true" className="shortcut-key-group">
        {parts.length ? (
          parts.map((part, index) => (
            <span className="shortcut-key-part" key={`${part}-${String(index)}`}>
              <kbd>{part}</kbd>
              {index < parts.length - 1 ? <i>+</i> : null}
            </span>
          ))
        ) : (
          <span className="shortcut-empty">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
