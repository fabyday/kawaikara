import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Flex,
  Text
} from '@kawaikara/kawai-ui';
import {
  type CSSProperties
} from 'react';
import type {
  AppMessages,
  SiteMenuItem
} from '../../../../Common/IPC';
import { SiteIcon } from '../../../Component/SiteIcon';

/** Performs the sortable category row operation. */
export function SortableCategoryRow({
  category,
  count,
  index,
  length,
  messages,
  onMove,
}: {
  /** The category value. */
  readonly category: string;
  /** The count value. */
  readonly count: number;
  /** The index value. */
  readonly index: number;
  /** The length value. */
  readonly length: number;
  /** The messages value. */
  readonly messages: AppMessages;
  /** Callback used to handle on move. */
  readonly onMove: (direction: -1 | 1) => void;
}
) {
  const label = messages.categoryLabels[category] ?? category;
  const sortable = useSortable({
    id: category
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      className={`menu-order-category-row${sortable.isDragging ? ' is-dragging' : ''}`}
      ref={sortable.setNodeRef}
      style={style}
    >
      <DragHandle
        label={`${messages.dragToReorder}: ${label}`}
        sortable={sortable}
      />
      <div className="menu-order-row-copy">
        <Text weight="semibold">{label}</Text>
        <Text size="xs" tone="muted">{count} {messages.sites}</Text>
      </div>
      <OrderButtons
        index={index}
        itemLabel={label}
        length={length}
        messages={messages}
        onMove={onMove}
      />
    </div>
  );
}

/** Performs the sortable site row operation. */
export function SortableSiteRow({
  index,
  length,
  messages,
  site,
  onMove,
}: {
  /** The index value. */
  readonly index: number;
  /** The length value. */
  readonly length: number;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The site value. */
  readonly site: SiteMenuItem;
  /** Callback used to handle on move. */
  readonly onMove: (direction: -1 | 1) => void;
}
) {
  const sortable = useSortable({
    id: site.id
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      className={`menu-order-site${sortable.isDragging ? ' is-dragging' : ''}`}
      ref={sortable.setNodeRef}
      style={style}
    >
      <DragHandle
        label={`${messages.dragToReorder}: ${site.title}`}
        sortable={sortable}
      />
      <Flex className="menu-order-row-copy" align="center" gap="sm">
        <SiteIcon site={site} />
        <Text size="sm" weight="semibold">{site.title}</Text>
      </Flex>
      <OrderButtons
        index={index}
        itemLabel={site.title}
        length={length}
        messages={messages}
        onMove={onMove}
      />
    </div>
  );
}

/** Performs the drag handle operation. */
export function DragHandle({
  label,
  sortable,
}: {
  /** The label value. */
  readonly label: string;
  /** The sortable value. */
  readonly sortable: ReturnType<typeof useSortable>;
}
) {
  return (
    <button
      aria-label={label}
      className="menu-order-drag-handle"
      ref={sortable.setActivatorNodeRef}
      type="button"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <span aria-hidden="true">⠿</span>
    </button>
  );
}

/** Performs the order buttons operation. */
export function OrderButtons({
  index,
  itemLabel,
  length,
  messages,
  onMove,
}: {
  /** The index value. */
  readonly index: number;
  /** The item label value. */
  readonly itemLabel: string;
  /** The length value. */
  readonly length: number;
  /** The messages value. */
  readonly messages: AppMessages;
  /** Callback used to handle on move. */
  readonly onMove: (direction: -1 | 1) => void;
}
) {
  return (
    <Flex className="menu-order-actions" gap="xs">
      <Button
        aria-label={`${messages.moveUp}: ${itemLabel}`}
        disabled={index === 0}
        size="icon"
        variant="ghost"
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        aria-label={`${messages.moveDown}: ${itemLabel}`}
        disabled={index === length - 1}
        size="icon"
        variant="ghost"
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </Flex>
  );
}
