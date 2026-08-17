import type { PreferenceState, SiteMenuItem } from '../../Common/IPC';

export type SiteMenuGroup = readonly [category: string, sites: SiteMenuItem[]];

const MENU_CATEGORY_SHORTCUT_PREFIX = 'menu-category:';

export function createOrderedSiteGroups(
  sites: readonly SiteMenuItem[],
  preferences?: Pick<PreferenceState, 'menuCategoryOrder' | 'menuSiteOrder'>,
): SiteMenuGroup[] {
  const sourceGroups = new Map<string, SiteMenuItem[]>();
  for (const site of sites) {
    const items = sourceGroups.get(site.category) ?? [];
    items.push(site);
    sourceGroups.set(site.category, items);
  }

  const categories = applyPreferredOrder(
    [...sourceGroups.keys()],
    preferences?.menuCategoryOrder ?? [],
  );
  return categories.map((category) => [
    category,
    applyPreferredOrder(
      sourceGroups.get(category) ?? [],
      preferences?.menuSiteOrder ?? [],
      (site) => site.id,
    ),
  ]);
}

export function applyPreferredOrder<T>(
  items: readonly T[],
  preferredIds: readonly string[],
  getId: (item: T) => string = (item) => String(item),
): T[] {
  const positions = new Map(
    preferredIds.map((id, index) => [id, index] as const),
  );
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const leftPosition = positions.get(getId(left.item));
      const rightPosition = positions.get(getId(right.item));
      if (leftPosition === undefined && rightPosition === undefined) {
        return left.sourceIndex - right.sourceIndex;
      }
      if (leftPosition === undefined) return 1;
      if (rightPosition === undefined) return -1;
      return leftPosition - rightPosition;
    })
    .map(({ item }) => item);
}

export function moveOrderedItem<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function getMenuCategoryShortcutId(category: string): string {
  return `${MENU_CATEGORY_SHORTCUT_PREFIX}${category}`;
}

export function getDefaultMenuCategoryShortcut(index: number): string {
  return index >= 0 && index < 9 ? String(index + 1) : '';
}

export function matchesKeyboardAccelerator(
  event: KeyboardEvent,
  accelerator: string,
): boolean {
  if (!accelerator.trim() || event.repeat || event.isComposing) return false;
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return false;

  let control = false;
  let meta = false;
  let alt = false;
  let shift = false;
  const apple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  for (const modifier of parts) {
    switch (modifier) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (apple) meta = true;
        else control = true;
        break;
      case 'command':
      case 'cmd':
      case 'super':
        meta = true;
        break;
      case 'control':
      case 'ctrl':
        control = true;
        break;
      case 'alt':
      case 'option':
        alt = true;
        break;
      case 'shift':
        shift = true;
        break;
      default:
        return false;
    }
  }

  return (
    event.ctrlKey === control &&
    event.metaKey === meta &&
    event.altKey === alt &&
    event.shiftKey === shift &&
    normalizeKeyboardKey(event.key) === normalizeKeyboardKey(key)
  );
}

function normalizeKeyboardKey(key: string): string {
  const normalized = key.toLowerCase();
  const aliases: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    return: 'enter',
    esc: 'escape',
    space: ' ',
    spacebar: ' ',
  };
  return aliases[normalized] ?? normalized;
}
