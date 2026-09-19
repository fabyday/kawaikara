import {
  Button,
  Flex,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  ProviderSettingListItem
} from '@kawaikara/site-api';
import {
  useState
} from 'react';
import { createPortal } from 'react-dom';
import type {
  AppMessages,
  AppTheme
} from '../../../../Common/IPC';

/** Performs the provider item list setting operation. */
export function ProviderItemListSetting({
  description,
  disabled,
  emptyText,
  items,
  messages,
  theme,
  title,
  onChange,
}: {
  /** The description value. */
  readonly description?: string;
  /** Whether the disabled option is enabled. */
  readonly disabled: boolean;
  /** The empty text value. */
  readonly emptyText: string;
  /** The items value. */
  readonly items: readonly ProviderSettingListItem[];
  /** The messages value. */
  readonly messages: AppMessages;
  /** The theme value. */
  readonly theme: AppTheme;
  /** The title value. */
  readonly title: string;
  /** Callback used to handle on change. */
  readonly onChange: (items: readonly ProviderSettingListItem[]) => void;
}
) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const visibleItems = items.slice(0, 5);
  const selected = new Set(selectedIds);
  /** Removes the IDs. */
  const removeIds = (ids: ReadonlySet<string>) => {
    onChange(items.filter((item) => !ids.has(item.id)));
    setSelectedIds([]);
    if (ids.size === items.length) setDialogOpen(false);
  };

  const dialog = dialogOpen ? createPortal(
    <div
      className={`kawai-theme preference-dialog-backdrop bundle-list-dialog-backdrop ${theme === 'dark' ? 'kawai-theme-dark' : 'kawai-theme-light'
        }`}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        setSelectedIds([]);
        setDialogOpen(false);
      }}
    >
      <div
        aria-label={title}
        aria-modal="true"
        className="preference-dialog bundle-list-dialog"
        role="dialog"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Flex align="center" justify="between" gap="md">
          <Stack gap="xs">
            <Text weight="semibold">{title}</Text>
            <Text size="xs" tone="muted">
              {messages.bundleListCount.replace('{count}', String(items.length))}
            </Text>
          </Stack>
          <Button size="sm" variant="ghost" onClick={() => {
            setSelectedIds([]);
            setDialogOpen(false);
          }}>
            {messages.done}
          </Button>
        </Flex>
        <Flex className="bundle-list-actions" align="center" justify="between" gap="sm">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelectedIds(
              selectedIds.length === items.length ? [] : items.map(({ id }) => id),
            )}
          >
            {selectedIds.length === items.length
              ? messages.clearSelection
              : messages.selectAll}
          </Button>
          <Button
            disabled={disabled || selectedIds.length === 0}
            size="sm"
            variant="secondary"
            onClick={() => removeIds(selected)}
          >
            {messages.removeSelected.replace('{count}', String(selectedIds.length))}
          </Button>
        </Flex>
        <div className="bundle-list-dialog-content">
          {items.map((item) => (
            <div
              className={`bundle-item-list-row is-dialog${selected.has(item.id) ? ' is-selected' : ''}`}
              key={item.id}
            >
              <input
                aria-label={item.label}
                checked={selected.has(item.id)}
                disabled={disabled}
                type="checkbox"
                onChange={() => setSelectedIds((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )}
              />
              <ProviderListItemIdentity item={item} />
              {selectedIds.length === 0 ? (
                <Button
                  disabled={disabled}
                  size="sm"
                  variant="ghost"
                  onClick={() => removeIds(new Set([item.id]))}
                >
                  {messages.remove}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="bundle-item-list-setting">
      <Stack gap="xs">
        <Text size="sm" weight="semibold">{title}</Text>
        {description ? <Text size="xs" tone="muted">{description}</Text> : null}
      </Stack>
      {items.length ? (
        <div className="bundle-item-list-compact">
          {visibleItems.map((item) => (
            <div className="bundle-item-list-row" key={item.id}>
              <ProviderListItemIdentity item={item} />
              <Button
                disabled={disabled}
                size="sm"
                variant="ghost"
                onClick={() => removeIds(new Set([item.id]))}
              >
                {messages.remove}
              </Button>
            </div>
          ))}
          {items.length > 5 ? (
            <button
              className="bundle-item-list-more"
              type="button"
              onClick={() => setDialogOpen(true)}
            >
              <span>{messages.showMore}</span>
              <span aria-hidden="true" className="bundle-more-chevron">⌄</span>
            </button>
          ) : null}
        </div>
      ) : <Text size="xs" tone="muted">{emptyText}</Text>}
      {dialog}
    </div>
  );
}

/** Performs the provider list item identity operation. */
export function ProviderListItemIdentity({ item }: {
  /** The item value. */
  readonly item: ProviderSettingListItem;
}
) {
  const secondary = item.description ?? (item.label !== item.id ? item.id : undefined);
  return (
    <div className="bundle-list-identity">
      {item.imageUrl ? (
        <img alt="" className="bundle-list-avatar" src={item.imageUrl} />
      ) : (
        <span aria-hidden="true" className="bundle-list-avatar is-placeholder">
          {item.label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <Stack gap="xs">
        <Text size="sm" weight="semibold">{item.label}</Text>
        {secondary ? <Text size="xs" tone="muted">{secondary}</Text> : null}
      </Stack>
    </div>
  );
}
