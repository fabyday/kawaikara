import {
  type PointerEvent as ReactPointerEvent
} from 'react';
import { ResizableLogColumn } from '../Types';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogColumnResize. */
type LogColumnResizeOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'resizeCleanupRef'
  | 'columnWidths'
  | 'setColumnWidths'
>;

/** Coordinates log column resize behavior for this View. */
export function useLogColumnResize({
  resizeCleanupRef,
  columnWidths,
  setColumnWidths,
}: LogColumnResizeOptions) {
  /** Starts pointer-driven resizing for one table column. */
  const startColumnResize = (
    column: ResizableLogColumn,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = columnWidths[column];
    const limits = {
      time: [130, 280],
      level: [72, 180],
      location: [140, 480],
    } as const;
    /** Updates the selected width while the pointer moves. */
    const handleMove = (moveEvent: PointerEvent) => {
      const [minimum, maximum] = limits[column];
      const width = Math.max(
        minimum,
        Math.min(maximum, startWidth + moveEvent.clientX - startX),
      );
      setColumnWidths((current) => ({
        ...current, [column]: width
      }));
    };
    /** Releases global resize listeners. */
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      resizeCleanupRef.current = undefined;
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup, {
      once: true
    });
  };

  return {
    /** The startColumnResize value. */
    startColumnResize,
  };
}
