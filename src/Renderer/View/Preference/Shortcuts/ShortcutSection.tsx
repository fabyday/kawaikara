import {
  Button,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  PreferenceState
} from '../../../../Common/IPC';
import { ShortcutItem } from '../Types';
import { formatAccelerator, getEffectiveShortcut } from './ShortcutBindings';
import { ShortcutRecorder } from './ShortcutRecorder';

/** Performs the shortcut section operation. */
export function ShortcutSection({
  description,
  duplicateIds,
  items,
  messages,
  preferences,
  saving,
  title,
  onChange,
}: {
  /** The description value. */
  readonly description?: string;
  /** The duplicate IDs value. */
  readonly duplicateIds: ReadonlySet<string>;
  /** The items value. */
  readonly items: readonly ShortcutItem[];
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** The title value. */
  readonly title: string;
  /** Callback used to handle on change. */
  readonly onChange: (item: ShortcutItem, value: string) => void;
}
) {
  return (
    <section className="shortcut-section">
      <Text className="preference-section-title" weight="semibold">
        {title}
      </Text>
      {description ? (
        <Text className="shortcut-section-description" size="xs" tone="muted">
          {description}
        </Text>
      ) : null}
      <Stack gap="sm">
        {items.map((item) => {
          const value = getEffectiveShortcut(item, preferences.shortcuts);
          const isDuplicate = duplicateIds.has(item.id);
          return (
            <div
              className={`shortcut-row${isDuplicate ? ' is-duplicate' : ''}`}
              key={item.id}
            >
              <div className="shortcut-label">
                <Text weight="semibold">{item.title}</Text>
                {item.description ? (
                  <Text className="shortcut-current-category" size="xs" tone="muted">
                    {item.description}
                  </Text>
                ) : null}
                <Text className="shortcut-default" size="xs" tone="muted">
                  {messages.defaultValue}:{' '}
                  {item.defaultKey
                    ? formatAccelerator(item.defaultKey).join(' + ')
                    : messages.empty}
                </Text>
              </div>
              <ShortcutRecorder
                disabled={saving}
                emptyLabel={messages.empty}
                label={item.title}
                value={value}
                onChange={(accelerator) => onChange(item, accelerator)}
              />
              <Button
                aria-label={messages.reset}
                className="shortcut-reset-button"
                disabled={saving || value === item.defaultKey}
                size="sm"
                title={messages.reset}
                variant="ghost"
                onClick={() => onChange(item, item.defaultKey)}
              >
                <ResetShortcutIcon />
              </Button>
              {isDuplicate ? (
                <Text className="shortcut-duplicate" size="xs" tone="danger">
                  {messages.duplicateShortcut}
                </Text>
              ) : null}
            </div>
          );
        })}
      </Stack>
      <Text className="shortcut-capture-hint" size="xs" tone="muted">
        {messages.shortcutCapture}
      </Text>
    </section>
  );
}

/** Resets the shortcut icon. */
export function ResetShortcutIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M4.9 8.1A8 8 0 1 1 4 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.9 3.9v4.2H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
