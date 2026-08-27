import { serializePageInjectionWithOptions } from '@kawaikara/site-api';

/**
 * CHZZK quality-menu page-world implementation. ChzzkProvider.beforeLoad() in
 * Providers/Chzzk/Provider.ts constructs the action URLs and registers
 * createChzzkQualityEnhancementScript() with SitePagePipeline. No Main-process
 * Manager or other Provider executes this injection.
 */

export interface ChzzkQualityInjectionOptions {
  /** Whether the enable bypass action URL option is enabled. */
  readonly enableBypassActionUrl: string;
  /** Whether the enable720 bypass action URL option is enabled. */
  readonly enable720BypassActionUrl: string;
  /** The disable bypass action URL value. */
  readonly disableBypassActionUrl: string;
}

/** Installs the CHZZK quality menu. */
function installChzzkQualityMenu(
  options: ChzzkQualityInjectionOptions,
): void {
  /** Defines the public quality type. */
  type PublicQuality = '320' | '480' | '720' | '1080';

  /** Describes the quality menu state contract. */
  interface QualityMenuState {
    /** Performs the refresh operation. */
    refresh(): void;
    /** The observer value. */
    observer: MutationObserver;
    /** Performs the diagnostics operation. */
    diagnostics(): Record<string, unknown>;
  }

  /** Describes the native quality vue component contract. */
  interface NativeQualityVueComponent {
    /** The vnode value. */
    _vnode?: {
      /** The data value. */
      data?: {
        /** The on value. */
        on?: {
          /** Callback used to handle click. */
          click?: (event: MouseEvent) => unknown;
        };
      };
    };
    /** The listeners value. */
    $listeners?: {
      /** Callback used to handle click. */
      click?: (event: MouseEvent) => unknown;
    };
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkQualityMenu?: QualityMenuState;
  };
  const installed = pageGlobal.__kawaikaraChzzkQualityMenu;
  if (installed) {
    installed.refresh();
    return;
  }

  const nativeHomeSelector = [
    '.pzp-setting-intro-quality',
    '.pzp-pc-setting-intro-quality',
    '[class*="setting-intro-quality"]',
    '[role="menuitem"][label="Quality" i]',
    '[role="menuitem"][label="화질"]',
  ].join(',');
  const nativePaneSelector = [
    '.pzp-setting-quality-pane',
    '.pzp-pc-setting-quality-pane',
    '[class*="setting-quality-pane"]:not([class*="__"])',
    '[class*="quality-pane"]:not([class*="__"])',
  ].join(',');
  const nativeItemSelector = [
    'li.pzp-ui-setting-quality-item',
    'li.pzp-pc-ui-setting-quality-item',
    '[role="menuitem"]',
  ].join(',');
  const checkedClass = 'pzp-ui-setting-pane-item--checked';
  const highQualities = new Set<PublicQuality>(['720', '1080']);
  const labels: Record<PublicQuality, string> = {
    '1080': '1080p',
    '720': '720p',
    '480': '480p',
    '320': '320p',
  };
  const gateButtonPattern = [
    /설치\s*없이\s*일반\s*화질\s*시청/i,
    /일반\s*화질(?:로)?\s*시청/i,
    /watch\s+(?:in\s+)?(?:normal|standard)\s+quality/i,
  ];
  const gateCopyPattern =
    /브라우저\s*확장\s*프로그램|확장\s*프로그램.*설치|고화질\s*시청/i;

  let selectedQuality: PublicQuality = '1080';
  let routeKey = location.pathname;
  let refreshTimer = 0;
  let selectionRevision = 0;
  let gateBypassCount = 0;
  let lastProviderQuality: '' | '720' | '1080' = '1080';
  let lastGuardedQuality: '' | '720' | '1080' = '';
  let lastGuardedQualityAt = 0;
  let initializedPanes = new WeakSet<HTMLElement>();
  const nativeClickTimers = new Set<number>();
  const bypassedGateButtons = new WeakSet<HTMLElement>();

  /** Performs the normalized text operation. */
  const normalizedText = (element: Element | null): string =>
    String(element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  /** Determines whether the high quality condition applies. */
  const isHighQuality = (
    quality: PublicQuality,
  ): quality is '720' | '1080' => highQualities.has(quality);

  /** Ensures the style. */
  const ensureStyle = (): void => {
    if (document.getElementById('kawaikara-chzzk-quality-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'kawaikara-chzzk-quality-menu-style';
    style.textContent = `
      [data-kawaikara-native-quality-home="true"],
      [data-kawaikara-native-quality-pane="true"],
      [data-kawaikara-extension-gate="true"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      [data-kawaikara-quality-pane="true"] {
        display: none !important;
      }
      [data-kawaikara-quality-open="true"] > :not([data-kawaikara-quality-pane="true"]) {
        display: none !important;
      }
      [data-kawaikara-quality-open="true"] > [data-kawaikara-quality-pane="true"] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      [data-kawaikara-quality-managed="true"] [class*="track-badge"] {
        display: inline-flex !important;
        align-items: center !important;
      }
      [data-kawaikara-quality-managed="true"] [class*="badge__badge"],
      [data-kawaikara-quality-home="true"] [class*="badge__badge"] {
        color: #00ffa3 !important;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  };

  /** Performs the native pane operation. */
  const nativePane = (): HTMLElement | null =>
    Array.from(document.querySelectorAll<HTMLElement>(nativePaneSelector)).find(
      (pane) => pane.dataset.kawaikaraQualityPane !== 'true',
    ) ?? null;

  /** Performs the native items operation. */
  const nativeItems = (): HTMLElement[] => {
    const pane = nativePane();
    if (!pane) return [];
    return Array.from(pane.querySelectorAll<HTMLElement>(nativeItemSelector))
      .filter((item) => /(?:320|360|480|720|1080)\s*p/i.test(normalizedText(item)));
  };

  /** Performs the quality of native item operation. */
  const qualityOfNativeItem = (item: HTMLElement): string =>
    /(?:^|\D)(320|360|480|720|1080)\s*p/i.exec(normalizedText(item))?.[1] ?? '';

  /** Finds the native item. */
  const findNativeItem = (quality: string): HTMLElement | null =>
    nativeItems().find((item) => qualityOfNativeItem(item) === quality) ?? null;

  /** Determines whether the native item selected condition applies. */
  const isNativeItemSelected = (item: HTMLElement | null): boolean =>
    Boolean(
      item &&
        (item.classList.contains(checkedClass) ||
          item.getAttribute('aria-checked') === 'true' ||
          item.getAttribute('aria-selected') === 'true'),
    );

  /** Performs the click native item operation. */
  const clickNativeItem = (item: HTMLElement | null): boolean => {
    if (!item || !item.isConnected) return false;
    // CHZZK's Vue event wrapper ignores HTMLElement.click() while its native
    // quality pane is hidden. Invoke the component's own click callback so
    // low-quality selections and the internal 480p source still change.
    const component = (item as HTMLElement & {
      __vue__?: NativeQualityVueComponent;
    }).__vue__;
    const nativeClick = component?._vnode?.data?.on?.click ??
      component?.$listeners?.click;
    if (typeof nativeClick === 'function') {
      nativeClick.call(component, new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      return true;
    }
    item.click();
    return true;
  };

  /** Schedules the native click. */
  const scheduleNativeClick = (
    callback: () => void,
    delay: number,
  ): void => {
    const timer = window.setTimeout(() => {
      nativeClickTimers.delete(timer);
      callback();
    }, delay);
    nativeClickTimers.add(timer);
  };

  /** Performs the signal provider operation. */
  const signalProvider = (quality: PublicQuality): void => {
    const providerQuality = isHighQuality(quality) ? quality : '';
    if (lastProviderQuality === providerQuality) return;
    lastProviderQuality = providerQuality;
    const actionUrl = providerQuality === '1080'
      ? options.enableBypassActionUrl
      : providerQuality === '720'
        ? options.enable720BypassActionUrl
        : options.disableBypassActionUrl;
    window.location.assign(actionUrl);
  };

  /** Removes the IDs. */
  const removeIds = (root: HTMLElement): void => {
    root.removeAttribute('id');
    for (const element of root.querySelectorAll<HTMLElement>('[id]')) {
      element.removeAttribute('id');
    }
  };

  /** Clears the inherited hidden state. */
  const clearInheritedHiddenState = (root: HTMLElement): void => {
    for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      if (element.style.display === 'none') element.style.removeProperty('display');
      if (element.style.visibility === 'hidden') {
        element.style.removeProperty('visibility');
      }
      if (element.style.opacity === '0') element.style.removeProperty('opacity');
      if (element.style.pointerEvents === 'none') {
        element.style.removeProperty('pointer-events');
      }
    }
  };

  /** Sets the badge. */
  const setBadge = (
    container: HTMLElement | null,
    text: string,
  ): void => {
    if (!container) return;
    if (normalizedText(container) === text) return;
    container.replaceChildren();
    if (!text) return;
    const badge = document.createElement('em');
    badge.className = 'pzp-ui-track-badge__badge';
    badge.textContent = text;
    container.append(badge);
  };

  /** Updates the home. */
  const updateHome = (home: HTMLElement): void => {
    let value = home.querySelector<HTMLElement>(
      '.pzp-ui-setting-home-item__value, [class*="setting-home-item__value"]',
    );
    if (!value) {
      const right = home.querySelector<HTMLElement>(
        '.pzp-ui-setting-home-item__right, [class*="setting-home-item__right"]',
      );
      const icon = right?.querySelector<HTMLElement>(
        '.pzp-ui-setting-home-item__icon, [class*="setting-home-item__icon"]',
      );
      if (right) {
        value = document.createElement('span');
        value.className = 'pzp-ui-setting-home-item__value';
        right.insertBefore(value, icon ?? null);
      }
    }
    if (value && normalizedText(value) !== labels[selectedQuality]) {
      value.textContent = labels[selectedQuality];
    }
    const badge = home.querySelector<HTMLElement>(
      '.pzp-ui-track-badge, [class*="track-badge"]',
    );
    setBadge(badge, isHighQuality(selectedQuality) ? 'Kawaikara' : '');
    home.setAttribute('value',
      `${labels[selectedQuality]}${isHighQuality(selectedQuality) ? ' Kawaikara' : ''}`,
    );
  };

  /** Updates the rows. */
  const updateRows = (pane: HTMLElement): void => {
    for (const row of pane.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality]',
    )) {
      const quality = row.dataset.kawaikaraQuality as PublicQuality | undefined;
      const selected = quality === selectedQuality;
      row.classList.toggle(checkedClass, selected);
      row.setAttribute('aria-checked', String(selected));
      row.setAttribute('aria-selected', String(selected));
    }
  };

  /** Performs the synchronize presentation operation. */
  const synchronizePresentation = (): void => {
    for (const home of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-home="true"]',
    )) {
      updateHome(home);
    }
    for (const pane of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-pane="true"]',
    )) {
      updateRows(pane);
    }
  };

  /** Closes the menu. */
  const closeMenu = (root?: HTMLElement | null): void => {
    const settings = root ?? document.querySelector<HTMLElement>(
      '.pzp-settings.pzp-pc-settings, .pzp-pc__settings',
    );
    if (settings) delete settings.dataset.kawaikaraQualityOpen;
  };

  /** Opens the menu. */
  const openMenu = (home: HTMLElement): void => {
    const settings = home.parentElement;
    if (!settings) return;
    settings.dataset.kawaikaraQualityOpen = 'true';
    const selected = settings.querySelector<HTMLElement>(
      `[data-kawaikara-quality="${selectedQuality}"]`,
    );
    selected?.focus({ preventScroll: true
    });
  };

  /** Performs the restart internal480 operation. */
  const restartInternal480 = (revision: number): void => {
    const source = findNativeItem('480');
    if (!source) return;
    const fallback = findNativeItem('360') ?? findNativeItem('320');
    if (isNativeItemSelected(source) && fallback) {
      clickNativeItem(fallback);
      scheduleNativeClick(() => {
        if (revision !== selectionRevision) return;
        clickNativeItem(findNativeItem('480'));
      }, 90);
      return;
    }
    clickNativeItem(source);
  };

  /** Applies the selection. */
  const applySelection = (quality: PublicQuality): void => {
    selectedQuality = quality;
    const revision = ++selectionRevision;
    synchronizePresentation();
    closeMenu();
    signalProvider(quality);

    // App actions are delivered through a navigation URL. Give the Provider
    // time to commit its target before asking CHZZK for the internal track.
    scheduleNativeClick(() => {
      if (revision !== selectionRevision) return;
      if (quality === '320') {
        // CHZZK currently exposes 360p as its lowest native track. Keep the
        // public 320p compatibility label requested by Kawaikara and delegate
        // playback to that safe native low-quality row.
        clickNativeItem(findNativeItem('320') ?? findNativeItem('360'));
        return;
      }
      restartInternal480(revision);
    }, 160);
    console.info('[Kawaikara/CHZZK][quality]', {
      selected: `${quality}p`,
      internalTrack: quality === '320' ? '360p-compatible' : '480p',
      bypassTarget: isHighQuality(quality) ? `${quality}p` : null,
    });
  };

  /** Performs the guard native high quality operation. */
  const guardNativeHighQuality = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>(nativeItemSelector);
    const pane = item?.closest<HTMLElement>(nativePaneSelector);
    if (!item || !pane || pane.dataset.kawaikaraQualityPane === 'true') return;
    const quality = qualityOfNativeItem(item);
    if (quality !== '720' && quality !== '1080') return;

    // Block CHZZK before its locked high-quality handler can open the browser
    // extension gate. pointerdown handles real mouse/touch activation while
    // click remains a keyboard/automation fallback.
    event.preventDefault();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (lastGuardedQuality === quality && now - lastGuardedQualityAt < 500) {
      return;
    }
    lastGuardedQuality = quality;
    lastGuardedQualityAt = now;
    applySelection(quality);
  };

  /** Creates the row. */
  const createRow = (
    quality: PublicQuality,
    template: HTMLElement,
  ): HTMLElement => {
    const row = template.cloneNode(true) as HTMLElement;
    removeIds(row);
    // CHZZK places inline display:none on the inactive native pane and all of
    // its descendants. A clone can otherwise stay invisible even after our
    // pane becomes active.
    clearInheritedHiddenState(row);
    row.dataset.kawaikaraQuality = quality;
    row.classList.remove(checkedClass);
    row.setAttribute('aria-checked', 'false');
    row.setAttribute('aria-selected', 'false');
    if (isHighQuality(quality)) row.dataset.kawaikaraQualityManaged = 'true';

    const prefix = row.querySelector<HTMLElement>(
      '.pzp-ui-setting-quality-item__prefix, [class*="quality-item__prefix"]',
    );
    if (prefix) prefix.textContent = `${labels[quality]}\u00a0`;
    const badge = row.querySelector<HTMLElement>(
      '.pzp-ui-track-badge, [class*="track-badge"]',
    );
    setBadge(badge, isHighQuality(quality) ? 'Kawaikara' : '');
    const right = row.querySelector<HTMLElement>(
      '.pzp-ui-setting-quality-item__right, [class*="quality-item__right"]',
    );
    if (right && !isHighQuality(quality)) right.remove();

    row.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      applySelection(quality);
    }, true);
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applySelection(quality);
    }, true);
    return row;
  };

  /** Builds the custom pane. */
  const buildCustomPane = (
    sourcePane: HTMLElement,
    settings: HTMLElement,
  ): HTMLElement | null => {
    const sourceRows = nativeItems();
    const fallbackTemplate = sourceRows[0];
    if (!fallbackTemplate) return null;
    const pane = sourcePane.cloneNode(true) as HTMLElement;
    removeIds(pane);
    clearInheritedHiddenState(pane);
    delete pane.dataset.kawaikaraNativeQualityPane;
    pane.dataset.kawaikaraQualityPane = 'true';
    pane.removeAttribute('aria-hidden');
    const list = pane.querySelector<HTMLElement>(
      '.pzp-setting-quality-pane__list-container, [class*="quality-pane__list"]',
    );
    if (!list) return null;
    list.replaceChildren();
    const order: PublicQuality[] = ['1080', '720', '480', '320'];
    for (const quality of order) {
      const nativeQuality = quality === '320' ? '360' : quality;
      const template = sourceRows.find(
        (row) => qualityOfNativeItem(row) === nativeQuality,
      ) ?? fallbackTemplate;
      list.append(createRow(quality, template));
    }

    const header = pane.querySelector<HTMLElement>(
      '.pzp-ui-setting-pane-header, [aria-label="backward"]',
    );
    header?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu(settings);
    }, true);
    header?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu(settings);
    }, true);
    updateRows(pane);
    return pane;
  };

  /** Installs the menu. */
  const installMenu = (): void => {
    const sourceHome = Array.from(
      document.querySelectorAll<HTMLElement>(nativeHomeSelector),
    ).find((home) => home.dataset.kawaikaraQualityHome !== 'true');
    const sourcePane = nativePane();
    const settings = sourceHome?.parentElement;
    if (!sourceHome || !sourcePane || !settings) return;

    sourceHome.dataset.kawaikaraNativeQualityHome = 'true';
    sourcePane.dataset.kawaikaraNativeQualityPane = 'true';
    let customHome = settings.querySelector<HTMLElement>(
      ':scope > [data-kawaikara-quality-home="true"]',
    );
    if (!customHome) {
      customHome = sourceHome.cloneNode(true) as HTMLElement;
      removeIds(customHome);
      customHome.dataset.kawaikaraQualityHome = 'true';
      delete customHome.dataset.kawaikaraNativeQualityHome;
      customHome.classList.remove(
        'pzp-setting-intro-quality',
        'pzp-pc-setting-intro-quality',
      );
      customHome.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openMenu(customHome as HTMLElement);
      }, true);
      customHome.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openMenu(customHome as HTMLElement);
      }, true);
      sourceHome.insertAdjacentElement('afterend', customHome);
    }

    let customPane = settings.querySelector<HTMLElement>(
      ':scope > [data-kawaikara-quality-pane="true"]',
    );
    if (!customPane) {
      customPane = buildCustomPane(sourcePane, settings);
      if (customPane) settings.append(customPane);
    }
    synchronizePresentation();

    if (!initializedPanes.has(sourcePane)) {
      initializedPanes.add(sourcePane);
      // The Provider is already in 1080p mode before page load. If CHZZK
      // remembered a native high row, move it to the safe internal 480p row;
      // its very first request is then upgraded by onBeforeRequest.
      const source480 = findNativeItem('480');
      if (source480 && !isNativeItemSelected(source480)) {
        const revision = ++selectionRevision;
        scheduleNativeClick(() => {
          if (revision === selectionRevision) clickNativeItem(findNativeItem('480'));
        }, 0);
      }
    }
  };

  /** Performs the bypass extension gate operation. */
  const bypassExtensionGate = (): void => {
    const candidates = document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"]',
    );
    for (const button of candidates) {
      if (
        bypassedGateButtons.has(button) ||
        !gateButtonPattern.some((pattern) => pattern.test(normalizedText(button)))
      ) {
        continue;
      }
      const container = button.closest<HTMLElement>(
        '[role="dialog"], [class*="layer"], [class*="dialog"], [class*="notice"]',
      ) ?? button.parentElement?.parentElement;
      const context = normalizedText(container ?? document.body);
      if (!gateCopyPattern.test(context)) continue;
      bypassedGateButtons.add(button);
      if (container) container.dataset.kawaikaraExtensionGate = 'true';
      gateBypassCount += 1;
      // Use the same Vue-aware path as the hidden native quality rows. The
      // gate may already be visually suppressed before its fallback action is
      // invoked, which makes CHZZK's outer HTMLElement.click wrapper a no-op.
      clickNativeItem(button);
      console.info(
        '[Kawaikara/CHZZK][quality] browser extension gate suppressed; normal player requested',
      );
    }
  };

  /** Performs the refresh operation. */
  const refresh = (): void => {
    if (location.pathname !== routeKey) {
      routeKey = location.pathname;
      selectedQuality = '1080';
      lastProviderQuality = '';
      initializedPanes = new WeakSet<HTMLElement>();
      signalProvider('1080');
    }
    ensureStyle();
    bypassExtensionGate();
    installMenu();
    for (const settings of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-open="true"]',
    )) {
      if (!settings.closest('.pzp-pc--setting')) closeMenu(settings);
    }
  };

  /** Schedules the refresh. */
  const scheduleRefresh = (): void => {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      refresh();
    }, 0);
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-hidden'],
    childList: true,
    subtree: true,
  });
  const routeTimer = window.setInterval(refresh, 750);
  window.addEventListener('pointerdown', guardNativeHighQuality, true);
  window.addEventListener('click', guardNativeHighQuality, true);
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    window.clearInterval(routeTimer);
    if (refreshTimer) window.clearTimeout(refreshTimer);
    for (const timer of nativeClickTimers) window.clearTimeout(timer);
    nativeClickTimers.clear();
    window.removeEventListener('pointerdown', guardNativeHighQuality, true);
    window.removeEventListener('click', guardNativeHighQuality, true);
  }, { once: true
  });

  /** Performs the diagnostics operation. */
  const diagnostics = (): Record<string, unknown> => ({
    selectedQuality: `${selectedQuality}p`,
    bypassTarget: isHighQuality(selectedQuality) ? `${selectedQuality}p` : null,
    nativeSource: selectedQuality === '320' ? '360p-compatible' : '480p',
    customHomes: document.querySelectorAll('[data-kawaikara-quality-home]').length,
    customPanes: document.querySelectorAll('[data-kawaikara-quality-pane]').length,
    gateBypassCount,
  });
  pageGlobal.__kawaikaraChzzkQualityMenu = { refresh, observer, diagnostics
  };
  console.info(
    '[Kawaikara/CHZZK][quality] custom menu installed; default is 1080p Kawaikara',
  );
  refresh();
}

/** Creates the CHZZK quality enhancement script. */
export function createChzzkQualityEnhancementScript(
  options: ChzzkQualityInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installChzzkQualityMenu, options);
}
