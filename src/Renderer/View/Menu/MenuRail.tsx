import {
  Button,
  Flex,
  Head,
  Panel,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  AppMessages,
  SiteMenuItem
} from '../../../Common/IPC';
import { ActivityBorder } from './ActivityBorder';
import {
  AutoHideScrollArea
} from '../../Component/AutoHideScrollArea';
import { GearIcon } from './GearIcon';
import { PictureInPictureButton } from './PictureInPictureButton';
import { SiteMenuButton } from './SiteMenuButton';
import type { SiteMenuGroup } from '../../Domain/MenuOrder';
import {
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId
} from '../../Domain/MenuOrder';
import { type useMenuState } from './Hooks/useMenuState';
import { type useMenuWindowActions } from './Hooks/useMenuWindowActions';
import { type useOverlayNavigation } from './Hooks/useOverlayNavigation';
import { AlwaysOnTopIcon } from './MenuIcons';

/** Inputs for the MenuRail section. */
type MenuRailProps = Pick<ReturnType<typeof useMenuState>,
  | 'pipMode'
  | 'pipFailureKey'
  | 'pipLoading'
  | 'preferences'
  | 'error'
  | 'shortcutTargetCategory'
  | 'categoryElements'
  | 'selectedId'
> & Pick<ReturnType<typeof useMenuWindowActions>,
  | 'togglePictureInPicture'
  | 'toggleAlwaysOnTop'
  | 'closeOverlay'
  | 'openSite'
> & Pick<ReturnType<typeof useOverlayNavigation>,
  | 'setOverlayView'
> & {
  /** The messages value for this section. */
  readonly messages: AppMessages;
  /** The selectedSite value for this section. */
  readonly selectedSite: SiteMenuItem | undefined;
  /** The groups value for this section. */
  readonly groups: SiteMenuGroup[];
};

/** Renders the MenuRail section of this View. */
export function MenuRail({
  messages,
  selectedSite,
  pipMode,
  pipFailureKey,
  pipLoading,
  togglePictureInPicture,
  preferences,
  toggleAlwaysOnTop,
  setOverlayView,
  closeOverlay,
  error,
  shortcutTargetCategory,
  groups,
  categoryElements,
  selectedId,
  openSite,
}: MenuRailProps) {
  return (
    <Panel className="menu-panel" padding="md" radius="lg">
      <MenuRailHeader
        messages={messages}
        selectedSite={selectedSite}
        pipMode={pipMode}
        pipFailureKey={pipFailureKey}
        pipLoading={pipLoading}
        togglePictureInPicture={togglePictureInPicture}
        preferences={preferences}
        toggleAlwaysOnTop={toggleAlwaysOnTop}
        setOverlayView={setOverlayView}
        closeOverlay={closeOverlay}
      />

      <div
        aria-live="polite"
        className={`menu-notice-slot${error ? ' has-error' : ''}`}
        role="status"
      >
        {error ?? ''}
      </div>

      <AutoHideScrollArea
        className="site-list"
        forceScrollbarVisible={shortcutTargetCategory !== undefined}
        label={messages.availableSites}
      >
        <Stack gap="md">
          {groups.map(([category, items], categoryIndex) => {
            const shortcut =
              preferences?.shortcuts[getMenuCategoryShortcutId(category)] ??
              getDefaultMenuCategoryShortcut(categoryIndex);
            return (
              <MenuCategory
                key={category}
                messages={messages}
                shortcutTargetCategory={shortcutTargetCategory}
                categoryElements={categoryElements}
                selectedId={selectedId}
                openSite={openSite}
                category={category}
                items={items}
                shortcut={shortcut}
              />
            );
          })}
        </Stack>
      </AutoHideScrollArea>

      <Text className="menu-hint" size="xs" tone="muted">
        {messages.menuHint}
      </Text>
    </Panel>
  );
}

/** Brand, PiP, always-on-top, settings, and close actions. */
function MenuRailHeader({
  messages,
  selectedSite,
  pipMode,
  pipFailureKey,
  pipLoading,
  togglePictureInPicture,
  preferences,
  toggleAlwaysOnTop,
  setOverlayView,
  closeOverlay,
}: Pick<MenuRailProps, 'messages' | 'selectedSite' | 'pipMode' | 'pipFailureKey' | 'pipLoading' | 'togglePictureInPicture' | 'preferences' | 'toggleAlwaysOnTop' | 'setOverlayView' | 'closeOverlay'>) {
  return (
    <Flex align="center" justify="between" gap="sm">
      <div>
        <Head level={1} size="md">
          {messages.title}
        </Head>
        <Text size="xs" tone="muted">
          {messages.chooseSite}
        </Text>
      </div>
      <Flex align="center" gap="xs">
        {(selectedSite?.pictureInPictureEnabled ?? true) ? (
          <PictureInPictureButton
            active={pipMode !== undefined}
            failureKey={pipFailureKey}
            isLoading={pipLoading}
            label={messages.pictureInPicture}
            shortLabel={messages.pipShort}
            onPress={() => void togglePictureInPicture()}
          />
        ) : null}
        <Button
          aria-label={messages.alwaysOnTop}
          aria-pressed={preferences?.alwaysOnTop ?? false}
          className={`overlay-icon-button always-on-top-button${preferences?.alwaysOnTop ? ' is-active' : ''
            }`}
          size="icon"
          title={messages.alwaysOnTop}
          variant="ghost"
          onClick={() => void toggleAlwaysOnTop()}
        >
          <AlwaysOnTopIcon />
          <ActivityBorder running={preferences?.alwaysOnTop ?? false} />
        </Button>
        <Button
          className="overlay-icon-button"
          aria-label={messages.openPreferences}
          size="icon"
          variant="ghost"
          onClick={() => setOverlayView('preference')}
        >
          <GearIcon />
        </Button>
        <Button
          className="overlay-icon-button overlay-close-button"
          aria-label={messages.closeMenu}
          size="icon"
          variant="ghost"
          onClick={closeOverlay}
        >
          <span aria-hidden="true" className="overlay-button-glyph">×</span>
        </Button>
      </Flex>
    </Flex>
  );
}

/** A category anchor with its shortcut hint and site buttons. */
function MenuCategory({
  messages,
  shortcutTargetCategory,
  categoryElements,
  selectedId,
  openSite,
  category,
  items,
  shortcut,
}: Pick<MenuRailProps, 'messages' | 'shortcutTargetCategory' | 'categoryElements' | 'selectedId' | 'openSite'> & {
  /** category supplied by the owning composition. */
  readonly category: SiteMenuGroup[0];
  /** items supplied by the owning composition. */
  readonly items: SiteMenuGroup[1];
  /** shortcut supplied by the owning composition. */
  readonly shortcut: string;
}) {
  return (
    <section
      className={`menu-category${shortcutTargetCategory === category ? ' is-shortcut-target' : ''
        }`}

      ref={(element) => {
        if (element) categoryElements.current.set(category, element);
        else categoryElements.current.delete(category);
      }}
    >
      <Flex align="center" justify="between" gap="sm">
        <Text
          className="category-title"
          size="xs"
          tone="muted"
          weight="semibold"
        >
          {messages.categoryLabels[category] ?? category}
        </Text>
        {shortcut ? (
          <kbd className="category-shortcut-badge">{shortcut}</kbd>
        ) : null}
      </Flex>
      <Stack gap="xs">
        {items.map((site) => (
          <SiteMenuButton
            isSelected={selectedId === site.id}
            key={site.id}
            selectedLabel={messages.selected}
            site={site}
            onOpen={openSite}
          />
        ))}
      </Stack>
    </section>
  );
}
