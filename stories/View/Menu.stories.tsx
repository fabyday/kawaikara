import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { SiteMenuItem } from '../../src/Common/IPC';
import { App } from '../../src/Renderer/View/Menu/App';
import { installKawaikaraMock } from '../Mocks/KawaikaraMock';

/** Defines the site-count boundaries exercised by Kawai Shortcut. */
const KAWAI_SHORTCUT_BOUNDARIES: readonly [string, number][] = [
  ['< 10', 9],
  ['= 10', 10],
  ['> 10', 11],
  ['> 20', 21],
] as const;

/** Creates deterministic menu fixtures for every shortcut page boundary. */
function createKawaiShortcutBoundarySites(): SiteMenuItem[] {
  return KAWAI_SHORTCUT_BOUNDARIES.flatMap(
    ([category, count], categoryIndex) => Array.from(
      { length: count },
      (_value, siteIndex): SiteMenuItem => {
        const categoryNumber = String(categoryIndex + 1);
        const siteNumber = String(siteIndex + 1);
        return {
          id: `storybook.kawai-shortcut.${categoryNumber}.${siteNumber}`,
          bundleId: 'storybook.kawai-shortcut-boundaries',
          title: `${category} Site ${siteNumber.padStart(2, '0')}`,
          addressHosts: [],
          category,
          panels: [],
          order: siteIndex,
          defaultShortcut: `Control+Alt+${String((siteIndex % 9) + 1)}`,
          actionShortcuts: [],
          supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
          defaultLocale: 'inherit',
          drm: false,
          pictureInPictureEnabled: true,
          isCurrent: categoryIndex === 0 && siteIndex === 0,
        };
      },
    ),
  );
}

/** Installs the shared Kawai Shortcut boundary fixture. */
function installKawaiShortcutBoundaryMock() {
  const sites = createKawaiShortcutBoundarySites();
  installKawaikaraMock({
    currentSiteId: sites[0]?.id,
    sites,
    preferences: {
      kawaiShortcutDelaySeconds: 5,
    },
  });
}

/** Returns the currently visible Kawai Shortcut page. */
function getActiveShortcutPage(canvasElement: HTMLElement) {
  const category = canvasElement.querySelector<HTMLElement>(
    '.menu-category.is-shortcut-target',
  );
  const keycaps = category
    ? Array.from(category.querySelectorAll<HTMLElement>(
      '.site-shortcut-keycaps.is-kawai-target',
    ))
    : [];
  return {
    /** The active category label. */
    category: category
      ?.querySelector<HTMLElement>('.category-title')
      ?.textContent
      ?.trim(),
    /** The numeric shortcut labels on the active page. */
    labels: keycaps.map((keycap) => keycap.textContent?.trim() ?? ''),
    /** The site titles represented by the active shortcut labels. */
    titles: keycaps.map((keycap) => ((keycap.closest('.site-button') as
      HTMLElement | null)
      ?.querySelector<HTMLElement>(':scope > span:not(.site-icon)')
      ?.textContent
      ?.trim() ?? '')),
  };
}

/** Waits until one shortcut page has the expected category and keys. */
async function expectShortcutPage(
  canvasElement: HTMLElement,
  category: string,
  labels: readonly string[],
  firstTitle: string,
) {
  await waitFor(() => {
    const page = getActiveShortcutPage(canvasElement);
    const categoryElement = canvasElement.querySelector<HTMLElement>(
      '.menu-category.is-shortcut-target',
    );
    expect(page.category).toBe(category);
    expect(page.labels).toEqual(labels);
    expect(page.titles[0]).toContain(firstTitle);
    expect(
      categoryElement?.querySelectorAll('.kawai-shortcut-page.is-active'),
    ).toHaveLength(1);
    expect(
      categoryElement?.querySelector('.kawai-shortcut-page.is-active')
        ?.querySelectorAll('.site-shortcut-keycaps.is-kawai-target'),
    ).toHaveLength(labels.length);
    expect(
      getComputedStyle(
        categoryElement!.querySelector<HTMLElement>(
          '.menu-category-header',
        )!,
      ).position,
    ).toBe('sticky');
  });
}

/** Waits for the expected shortcut page counter and button states. */
async function expectShortcutPagination(
  canvasElement: HTMLElement,
  label: string,
  previousDisabled: boolean,
  nextDisabled: boolean,
) {
  await waitFor(() => {
    const pagination = canvasElement.querySelector<HTMLElement>(
      '.menu-category.is-shortcut-target .kawai-shortcut-pagination',
    );
    const buttons = pagination?.querySelectorAll<HTMLButtonElement>(
      '.kawai-shortcut-page-button',
    );
    expect(
      pagination?.querySelector('.kawai-shortcut-page-number')?.textContent,
    ).toBe(label);
    expect(buttons?.[0]?.disabled).toBe(previousDisabled);
    expect(buttons?.[1]?.disabled).toBe(nextDisabled);
  });
}

/** Cancels Kawai Shortcut without closing the menu. */
async function cancelKawaiShortcut(canvasElement: HTMLElement) {
  await userEvent.keyboard('{Escape}');
  await waitFor(() => {
    expect(
      canvasElement.querySelector('.menu-category.is-shortcut-target'),
    ).toBeNull();
    expect(canvasElement.querySelector('.menu-panel')).not.toBeNull();
  });
}

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'View/Menu',
  /** The component value. */
  component: App,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-menu-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default = {} satisfies Story;

/** Stores the video library value. */
export const VideoLibrary = {
  /** The before each value. */
  beforeEach: () => {
    installKawaikaraMock({ currentSiteId: 'kawaikara.video' });
  },
} satisfies Story;

/** Stores the manual update available value. */
export const ManualUpdateAvailable = {
  /** The before each value. */
  beforeEach: () => {
    installKawaikaraMock({
      buildChannel: 'staging',
      updateAvailable: true,
    });
  },
} satisfies Story;

/** Provides the boundary fixture without automatic input for manual testing. */
export const KawaiShortcutBoundariesManual = {
  /** Installs deterministic boundary fixtures for direct keyboard input. */
  beforeEach: installKawaiShortcutBoundaryMock,
} satisfies Story;

/** Exercises Kawai Shortcut with fewer than 10, 10, over 10, and over 20 sites. */
export const KawaiShortcutBoundaries = {
  /** Installs deterministic boundary fixtures and a test-friendly timeout. */
  beforeEach: installKawaiShortcutBoundaryMock,
  /** Verifies numeric pages, arrow controls, sticky headers, and cancellation. */
  play: async ({ canvasElement }) => {
    const numericKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('.menu-category')).toHaveLength(4);
    });

    await userEvent.keyboard('1');
    await expectShortcutPage(
      canvasElement,
      '< 10',
      numericKeys.slice(0, 9),
      '< 10 Site 01',
    );
    await cancelKawaiShortcut(canvasElement);

    await userEvent.keyboard('2');
    await expectShortcutPage(
      canvasElement,
      '= 10',
      numericKeys,
      '= 10 Site 01',
    );
    await userEvent.keyboard('{ArrowRight}');
    await expectShortcutPage(
      canvasElement,
      '= 10',
      numericKeys,
      '= 10 Site 01',
    );
    await cancelKawaiShortcut(canvasElement);

    await userEvent.keyboard('3');
    await expectShortcutPage(
      canvasElement,
      '> 10',
      numericKeys,
      '> 10 Site 01',
    );
    await expectShortcutPagination(canvasElement, '1/2', true, false);
    await userEvent.click(
      canvasElement.querySelectorAll<HTMLButtonElement>(
        '.menu-category.is-shortcut-target .kawai-shortcut-page-button',
      )[1]!,
    );
    await expectShortcutPage(canvasElement, '> 10', ['1'], '> 10 Site 11');
    await expectShortcutPagination(canvasElement, '2/2', false, true);
    await userEvent.keyboard('{ArrowLeft}');
    await expectShortcutPage(canvasElement, '> 10', numericKeys, '> 10 Site 01');
    await cancelKawaiShortcut(canvasElement);

    await userEvent.keyboard('4');
    await expectShortcutPage(
      canvasElement,
      '> 20',
      numericKeys,
      '> 20 Site 01',
    );
    await expectShortcutPagination(canvasElement, '1/3', true, false);
    await userEvent.keyboard('{ArrowRight}');
    await expectShortcutPage(
      canvasElement,
      '> 20',
      numericKeys,
      '> 20 Site 11',
    );
    await expectShortcutPagination(canvasElement, '2/3', false, false);
    await userEvent.click(
      canvasElement.querySelectorAll<HTMLButtonElement>(
        '.menu-category.is-shortcut-target .kawai-shortcut-page-button',
      )[1]!,
    );
    await expectShortcutPage(canvasElement, '> 20', ['1'], '> 20 Site 21');
    await expectShortcutPagination(canvasElement, '3/3', false, true);
    await cancelKawaiShortcut(canvasElement);

    const menuPanel = canvasElement.querySelector<HTMLElement>('.menu-panel');
    if (menuPanel) {
      menuPanel.tabIndex = -1;
      menuPanel.focus({ preventScroll: true });
    }
  },
} satisfies Story;
