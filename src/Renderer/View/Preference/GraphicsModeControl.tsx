import {
  Text
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  GraphicsMode
} from '../../../Common/IPC';

/** Performs the graphics mode control operation. */
export function GraphicsModeControl({
  disabled,
  messages,
  value,
  onChange,
}: {
  /** Whether the disabled option is enabled. */
  readonly disabled: boolean;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The value value. */
  readonly value: GraphicsMode;
  /** Callback used to handle on change. */
  readonly onChange: (value: GraphicsMode) => void;
}
) {
  const options: readonly {
    readonly label: string;
    readonly description: string;
    readonly value: GraphicsMode;
  }[] = [
      {
        label: messages.graphicsModeNative,
        description: messages.graphicsModeNativeDescription,
        value: 'native',
      },
      {
        label: messages.graphicsModeCompatible,
        description: messages.graphicsModeCompatibleDescription,
        value: 'capture',
      },
      {
        label: messages.graphicsModeSoftware,
        description: messages.graphicsModeSoftwareDescription,
        value: 'software',
      },
    ];
  const selected = options.find((option) => option.value === value) ?? options[1];

  return (
    <div className="graphics-mode-setting">
      <Text size="sm" weight="medium">
        {messages.graphicsMode}
      </Text>
      <Text size="xs" tone="muted">
        {messages.graphicsModeDescription}
      </Text>
      <div
        aria-label={messages.graphicsMode}
        className="graphics-mode-control"
        role="radiogroup"
      >
        {options.map((option) => (
          <button
            aria-checked={option.value === value}
            className={option.value === value ? 'is-active' : undefined}
            disabled={disabled}
            key={option.value}
            role="radio"
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Text className="graphics-mode-selected-description" size="xs" tone="muted">
        {selected.description}
      </Text>
    </div>
  );
}
