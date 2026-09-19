import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  Button,
  Flex,
  Head,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import { AnimatePresence, motion } from 'motion/react';
import {
  useState
} from 'react';
import type {
  AppMessages,
  PreferencePatch,
  PreferenceState,
  SiteMenuItem
} from '../../../../Common/IPC';
import { AutoHideScrollArea } from '../../../Component/AutoHideScrollArea';
import {
  createOrderedSiteGroups,
  moveOrderedItem
} from '../../../Domain/MenuOrder';
import { SortableCategoryRow, SortableSiteRow } from './SortableRows';

/** Performs the menu order editor operation. */
export function MenuOrderEditor({
  messages,
  preferences,
  sites,
  onClose,
  onUpdate,
}: {
  /** The messages value. */
  readonly messages: AppMessages;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** The sites value. */
  readonly sites: readonly SiteMenuItem[];
  /** Callback used to handle on close. */
  readonly onClose: () => void;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}
) {
  const [mode, setMode] = useState<'categories' | 'sites'>('categories');
  const groups = createOrderedSiteGroups(sites, preferences);
  const categories = groups.map(([category]) => category);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    }),
  );

  /** Moves the category. */
  const moveCategory = (index: number, direction: -1 | 1) => {
    onUpdate({
      menuCategoryOrder: moveOrderedItem(categories, index, direction),
    });
  };

  /** Moves the site. */
  const moveSite = (category: string, index: number, direction: -1 | 1) => {
    const group = groups.find(([candidate]) => candidate === category);
    if (!group) return;
    writeSiteOrder(category, moveOrderedItem(group[1], index, direction));
  };

  /** Performs the write site order operation. */
  const writeSiteOrder = (
    category: string,
    orderedCategorySites: readonly SiteMenuItem[],
  ) => {
    const nextOrder = groups.flatMap(([groupCategory, groupSites]) => {
      const orderedSites = groupCategory === category
        ? orderedCategorySites
        : groupSites;
      return orderedSites.map((site) => site.id);
    });
    onUpdate({
      menuSiteOrder: nextOrder
    });
  };

  /** Handles the drag end. */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (mode === 'categories') {
      const oldIndex = categories.indexOf(activeId);
      const newIndex = categories.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      onUpdate({
        menuCategoryOrder: arrayMove(categories, oldIndex, newIndex)
      });
      return;
    }

    const group = groups.find(([, groupSites]) =>
      groupSites.some((site) => site.id === activeId),
    );
    if (!group || !group[1].some((site) => site.id === overId)) return;
    const oldIndex = group[1].findIndex((site) => site.id === activeId);
    const newIndex = group[1].findIndex((site) => site.id === overId);
    writeSiteOrder(group[0], arrayMove(group[1], oldIndex, newIndex));
  };

  return (
    <motion.div
      className="preference-dialog-backdrop menu-order-editor-backdrop"
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        aria-describedby="menu-order-description"
        aria-labelledby="menu-order-title"
        aria-modal="true"
        className="menu-order-editor"
        layout
        role="dialog"
        initial={{
          opacity: 0, scale: 0.95, y: 14
        }}
        animate={{
          opacity: 1, scale: 1, y: 0
        }}
        exit={{
          opacity: 0, scale: 0.95, y: 14
        }}
      >
        <Flex align="center" justify="between" gap="md">
          <div>
            <Head id="menu-order-title" level={2} size="sm">
              {messages.menuOrder}
            </Head>
            <Text id="menu-order-description" size="xs" tone="muted">
              {messages.menuOrderEditorDescription}
            </Text>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onUpdate({
                menuCategoryOrder: [], menuSiteOrder: []
              })
            }
          >
            {messages.resetMenuOrder}
          </Button>
        </Flex>

        <Flex className="menu-order-mode-switch" gap="xs">
          <Button
            className={mode === 'categories' ? 'is-active' : undefined}
            size="sm"
            variant="ghost"
            onClick={() => setMode('categories')}
          >
            {messages.menuOrderCategories}
          </Button>
          <Button
            className={mode === 'sites' ? 'is-active' : undefined}
            size="sm"
            variant="ghost"
            onClick={() => setMode('sites')}
          >
            {messages.menuOrderSites}
          </Button>
        </Flex>

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{
              opacity: 1, y: 0
            }}
            className="menu-order-mode-content"
            exit={{
              opacity: 0, y: mode === 'categories' ? -8 : 8
            }}
            initial={{
              opacity: 0, y: mode === 'categories' ? 8 : -8
            }}
            key={mode}
            transition={{
              duration: 0.18, ease: 'easeOut'
            }}
          >
            <DndContext
              collisionDetection={closestCenter}
              sensors={sensors}
              onDragEnd={handleDragEnd}
            >
              <AutoHideScrollArea
                className="menu-order-editor-list"
                label={messages.menuOrder}
              >
                {mode === 'categories' ? (
                  <SortableContext
                    items={categories}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack gap="xs">
                      {groups.map(([category, categorySites], index) => (
                        <SortableCategoryRow
                          category={category}
                          count={categorySites.length}
                          index={index}
                          key={category}
                          length={groups.length}
                          messages={messages}
                          onMove={(direction) => moveCategory(index, direction)}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                ) : (
                  <Stack gap="sm">
                    {groups.map(([category, categorySites]) => (
                      <section className="menu-order-category" key={category}>
                        <Text size="xs" tone="muted" weight="semibold">
                          {messages.categoryLabels[category] ?? category}
                        </Text>
                        <SortableContext
                          items={categorySites.map((site) => site.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <Stack gap="xs">
                            {categorySites.map((site, index) => (
                              <SortableSiteRow
                                index={index}
                                key={site.id}
                                length={categorySites.length}
                                messages={messages}
                                site={site}
                                onMove={(direction) =>
                                  moveSite(category, index, direction)
                                }
                              />
                            ))}
                          </Stack>
                        </SortableContext>
                      </section>
                    ))}
                  </Stack>
                )}
              </AutoHideScrollArea>
            </DndContext>
          </motion.div>
        </AnimatePresence>

        <Flex justify="end">
          <Button onClick={onClose}>{messages.done}</Button>
        </Flex>
      </motion.div>
    </motion.div>
  );
}
