import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from 'react';
import { Button, Panel, Stack } from '@kawaikara/kawai-ui';
import type { LogViewerMessages } from '../../../Common/IPC';

/** Describes the log file context menu props contract. */
export interface LogFileContextMenuProps {
  /** The viewport x coordinate value. */
  readonly x: number;
  /** The viewport y coordinate value. */
  readonly y: number;
  /** The selected log count value. */
  readonly selectionCount: number;
  /** Whether deletion is unavailable for the selection. */
  readonly deleteDisabled: boolean;
  /** The localized messages value. */
  readonly messages: LogViewerMessages;
  /** Callback used to export the selected logs. */
  readonly onExport: () => void;
  /** Callback used to open the owning log folder. */
  readonly onOpenFolder: () => void;
  /** Callback used to request deletion. */
  readonly onDelete: () => void;
  /** Callback used to close the menu. */
  readonly onClose: () => void;
}

/** Renders a dismissible context menu for selected history items. */
export function LogFileContextMenu({
  x,
  y,
  selectionCount,
  deleteDisabled,
  messages,
  onExport,
  onOpenFolder,
  onDelete,
  onClose,
}: LogFileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /** Closes the context menu when the pointer leaves it. */
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    /** Closes the context menu when Escape is pressed. */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    window.addEventListener('keydown', closeOnEscape, true);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      window.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [onClose]);
  return (
    <Panel
      className="log-file-context-menu"
      padding="sm"
      radius="md"
      ref={menuRef}
      role="menu"
      style={{ left: x, top: y
      }}
      onContextMenu={(event: ReactMouseEvent) => event.preventDefault()}
    >
      <Stack gap="xs">
        <Button
          role="menuitem"
          size="sm"
          variant="ghost"
          onClick={() => {
            onClose();
            onExport();
          }}
        >
          {selectionCount === 1 ? messages.exportLog : messages.exportLogs}
        </Button>
        <Button
          role="menuitem"
          size="sm"
          variant="ghost"
          onClick={() => {
            onClose();
            onOpenFolder();
          }}
        >
          {messages.openLogFolder}
        </Button>
        <Button
          className="log-file-context-delete"
          disabled={deleteDisabled}
          role="menuitem"
          size="sm"
          title={deleteDisabled ? messages.activeLogDeleteUnavailable : undefined}
          variant="ghost"
          onClick={() => {
            onClose();
            onDelete();
          }}
        >
          {selectionCount === 1 ? messages.deleteLog : messages.deleteLogs}
        </Button>
      </Stack>
    </Panel>
  );
}
