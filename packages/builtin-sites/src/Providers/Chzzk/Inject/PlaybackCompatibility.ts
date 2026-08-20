/**
 * CHZZK playback compatibility injections, grouped separately from Clips.
 *
 * Serializes a page-world entry point for Electron's executeJavaScript API.
 *
 * An entry point must remain self-contained: it cannot close over imports or
 * module-level variables because only the function source is sent to the page.
 * Keeping the implementation as TypeScript still gives us DOM autocomplete,
 * strict type checking, navigation, and safe refactoring before serialization.
 */
function serializePageInjection(entryPoint: () => void): string {
  return `(${entryPoint.toString()})();`;
}

function serializePageInjectionWithOptions<T>(
  entryPoint: (options: T) => void,
  options: T,
): string {
  return `(${entryPoint.toString()})(${JSON.stringify(options)});`;
}

function installChzzkAdResponseBlocker(): void {
  type JsonRecord = Record<string, unknown>;
  type AdPatchKind = 'display-status' | 'ad-schedule';

  interface AdBlockerState {
    diagnostics(): Record<string, unknown>;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkAdRequestBlocker?: AdBlockerState;
  };
  if (
    pageGlobal.__kawaikaraChzzkAdRequestBlocker ||
    !/(?:^|\.)chzzk\.naver\.com$/i.test(location.hostname)
  ) {
    return;
  }

  const displayStatusPattern = /\/ad\/display-status(?:[/?#]|$)/i;
  const schedulePattern = /^https:\/\/api\.chzzk\.naver\.com\/service\/t\//i;
  const xhrUrls = new WeakMap<XMLHttpRequest, string>();
  const patchedXhrs = new WeakSet<XMLHttpRequest>();
  let displayStatusPatchCount = 0;
  let schedulePatchCount = 0;

  const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const cloneJsonRecord = (value: JsonRecord): JsonRecord | undefined => {
    try {
      return JSON.parse(JSON.stringify(value)) as JsonRecord;
    } catch {
      return undefined;
    }
  };

  const patchJsonPayload = (
    url: string,
    value: unknown,
  ): { value: unknown; kind?: AdPatchKind } => {
    if (!isRecord(value)) return { value };

    if (displayStatusPattern.test(url)) {
      const clone = cloneJsonRecord(value);
      const content = clone?.content;
      const display = isRecord(content)
        ? content.playerAdDisplayResponse
        : undefined;
      if (clone && isRecord(display)) {
        display.preRoll = false;
        display.midRoll = false;
        return { value: clone, kind: 'display-status' };
      }
    }

    if (schedulePattern.test(url)) {
      const hasAds = Array.isArray(value.ads) && value.ads.length > 0;
      const hasAdBreaks =
        Array.isArray(value.adBreaks) && value.adBreaks.length > 0;
      if (hasAds || hasAdBreaks) {
        const clone = cloneJsonRecord(value);
        if (clone) {
          if (hasAds) clone.ads = [];
          if (hasAdBreaks) clone.adBreaks = [];
          return { value: clone, kind: 'ad-schedule' };
        }
      }
    }

    return { value };
  };

  const recordPatch = (kind: AdPatchKind): void => {
    if (kind === 'display-status') displayStatusPatchCount += 1;
    else schedulePatchCount += 1;
    const count = kind === 'display-status'
      ? displayStatusPatchCount
      : schedulePatchCount;
    if (count === 1 || count % 10 === 0) {
      console.info(
        `[Kawaikara/CHZZK][ad:block] neutralized ${kind} response ${JSON.stringify(
          { count },
        )}`,
      );
    }
  };

  const patchJsonText = (
    url: string,
    text: string,
  ): { value: string; kind?: AdPatchKind } => {
    if (!displayStatusPattern.test(url) && !schedulePattern.test(url)) {
      return { value: text };
    }
    try {
      const result = patchJsonPayload(url, JSON.parse(text) as unknown);
      return result.kind
        ? { value: JSON.stringify(result.value), kind: result.kind }
        : { value: text };
    } catch {
      return { value: text };
    }
  };

  const nativeXhr = window.XMLHttpRequest;
  const nativeOpen = nativeXhr.prototype.open;
  nativeXhr.prototype.open = function (
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['open']>
  ): void {
    xhrUrls.set(this, String(args[1] ?? ''));
    Reflect.apply(nativeOpen, this, args);
  } as XMLHttpRequest['open'];

  const installXhrResponsePatch = (property: 'response' | 'responseText'): boolean => {
    const descriptor = Object.getOwnPropertyDescriptor(nativeXhr.prototype, property);
    if (!descriptor?.get || descriptor.configurable === false) return false;
    const nativeGet = descriptor.get;
    Object.defineProperty(nativeXhr.prototype, property, {
      ...descriptor,
      get(this: XMLHttpRequest): unknown {
        const original = Reflect.apply(nativeGet, this, []) as unknown;
        const url = xhrUrls.get(this) ?? this.responseURL;
        const result = typeof original === 'string'
          ? patchJsonText(url, original)
          : patchJsonPayload(url, original);
        if (result.kind && !patchedXhrs.has(this)) {
          patchedXhrs.add(this);
          recordPatch(result.kind);
        }
        return result.value;
      },
    });
    return true;
  };

  let xhrResponsePatched = false;
  let xhrResponseTextPatched = false;
  try {
    xhrResponsePatched = installXhrResponsePatch('response');
    xhrResponseTextPatched = installXhrResponsePatch('responseText');
  } catch (error) {
    console.warn(
      `[Kawaikara/CHZZK][ad:block] XHR response interception unavailable: ${String(
        error,
      )}`,
    );
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (async (...args: Parameters<typeof window.fetch>) => {
    const response = await nativeFetch(...args);
    const input = args[0];
    const requestedUrl = response.url || (
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    );
    if (
      !displayStatusPattern.test(requestedUrl) &&
      !schedulePattern.test(requestedUrl)
    ) {
      return response;
    }

    try {
      const originalText = await response.clone().text();
      const result = patchJsonText(requestedUrl, originalText);
      if (!result.kind) return response;
      recordPatch(result.kind);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(result.value, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  }) as typeof window.fetch;

  const diagnostics = (): Record<string, unknown> => ({
    href: location.href,
    displayStatusPatchCount,
    schedulePatchCount,
    xhrResponsePatched,
    xhrResponseTextPatched,
  });
  pageGlobal.__kawaikaraChzzkAdRequestBlocker = { diagnostics };
  console.info(
    `[Kawaikara/CHZZK][ad:block] response interception installed ${JSON.stringify(
      { xhrResponsePatched, xhrResponseTextPatched, fetchPatched: true },
    )}`,
  );
}

export interface ChzzkQualityInjectionOptions {
  readonly enableBypassActionUrl: string;
  readonly disableBypassActionUrl: string;
}

function installChzzkQualityEnhancement(
  options: ChzzkQualityInjectionOptions,
): void {
  interface QualityInjectionState {
    refresh(force?: boolean): void;
    observer: MutationObserver;
    diagnostics(): Record<string, unknown>;
  }

  interface ChzzkVideoTrack {
    selected?: boolean;
    [property: string]: unknown;
  }

  interface ChzzkVideoTrackList {
    readonly length: number;
    selectedIndex?: number;
    item?(index: number): ChzzkVideoTrack | null;
    dispatchEvent?(event: Event): boolean;
    [index: number]: ChzzkVideoTrack | undefined;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkQualityEnhancement?: QualityInjectionState;
  };
  const installed = pageGlobal.__kawaikaraChzzkQualityEnhancement;
  if (installed) {
    installed.refresh(true);
    return;
  }

  const qualityItemSelector = [
    'div.pzp-setting-quality-pane ul > li',
    'li.pzp-ui-setting-quality-item',
    'li.pzp-pc-ui-setting-quality-item',
    '[class*="setting-quality-pane"] li',
  ].join(',');
  const nativeQualityCheckedClass = 'pzp-ui-setting-pane-item--checked';
  const playerSelector = [
    'pzp-pc',
    'pzp-player',
    'pzp-core-player',
    'pzp-pc-player',
    '[class^="pzp"]',
    '[class*=" pzp"]',
  ].join(',');
  const adVideoSourcePattern = /(?:tvetamovie|glad-vod)[^/]*\.pstatic\.net/i;
  const adVideoContainerSelector = [
    '[data-role="adVideoContainerEl"]',
    '[data-role*="ad-video" i]',
    '[class*="ad-video" i]',
    '[class*="advertisement-video" i]',
  ].join(',');
  const qualityTargetKeys = [
    '_corePlayer',
    'corePlayer',
    '_player',
    'player',
    '_controller',
    'controller',
    '_mediaController',
    'mediaController',
  ] as const;

  let routeKey = location.pathname;
  let routeApplied = false;
  let bypassRequested = false;
  let lastBypassSignal: boolean | undefined;
  let defaultQualityPending = true;
  let appliedTrackLists = new WeakSet<ChzzkVideoTrackList>();
  let refreshTimer = 0;
  let resolutionVerificationTimer = 0;
  let lastMenuActivationAt = 0;
  let lastQualityStatus = '';
  let decodedVideoWidth = 0;
  let decodedVideoHeight = 0;
  let qualityVerified = false;
  let automaticActivationAttempts = 0;
  const maximumAutomaticActivationAttempts = 4;
  const attachedVideos = new WeakSet<HTMLVideoElement>();
  const playbackRecoveryTimers = new WeakMap<HTMLVideoElement, number>();
  const playbackRecoveryTimerIds = new Set<number>();
  const retryTimers = new Set<number>();

  const logQuality = (
    status: string,
    details?: Record<string, unknown>,
  ): void => {
    const signature = `${status}:${JSON.stringify(details ?? {})}`;
    if (signature === lastQualityStatus) return;
    lastQualityStatus = signature;
    console.info(
      `[Kawaikara/CHZZK][quality] ${status}${
        details ? ` ${JSON.stringify(details)}` : ''
      }`,
    );
  };

  const isLiveRoute = (): boolean => /^\/live(?:\/|$)/.test(location.pathname);

  const read = <T>(target: unknown, property: PropertyKey): T | undefined => {
    if (
      target === null ||
      target === undefined ||
      (typeof target !== 'object' && typeof target !== 'function')
    ) {
      return undefined;
    }
    try {
      return Reflect.get(target, property) as T | undefined;
    } catch {
      return undefined;
    }
  };

  const signalProviderBypass = (enabled: boolean): void => {
    bypassRequested = enabled;
    if (lastBypassSignal === enabled) return;
    lastBypassSignal = enabled;
    const actionUrl = enabled
      ? options.enableBypassActionUrl
      : options.disableBypassActionUrl;
    window.location.assign(actionUrl);
    logQuality(`1080p request bypass ${enabled ? 'enabled' : 'disabled'}`);
  };

  const getQualityItems = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(qualityItemSelector));

  const getItemSource = (item: HTMLElement): '' | '480' | '1080' => {
    if (item.dataset.kawaikaraQualityBypass === '1080') return '1080';
    const text = String(item.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (/(?:^|\D)480\s*p?(?:\D|$)/i.test(text)) {
      return '480';
    }
    if (/(?:^|\D)1080\s*p?(?:\D|$)/i.test(text)) {
      return '1080';
    }
    return '';
  };

  const getItemLabelTarget = (item: HTMLElement): HTMLElement | null =>
    item.querySelector<HTMLElement>(
      '.pzp-pc-ui-setting-quality-item__prefix, .pzp-ui-setting-quality-item__prefix, [class*="quality-item__prefix"]',
    ) ?? item.querySelector<HTMLElement>('div:nth-child(2) > span > div');

  const decorateBypassItem = (item: HTMLElement): void => {
    // Keep CHZZK's real 480p item intact. The premium-looking 1080p row is
    // the public Kawaikara action; its click is intercepted below and routed
    // to the 480p track whose playlist is upgraded by onBeforeRequest.
    item.dataset.kawaikaraQualitySource = '1080';
    item.dataset.kawaikaraQualityBypass = '1080';

    const labelTarget = getItemLabelTarget(item);
    if (!labelTarget) return;
    if (!item.dataset.kawaikaraOriginalQualityLabel) {
      item.dataset.kawaikaraOriginalQualityLabel =
        String(labelTarget.textContent ?? '').trim() || '1080p HD';
    }
    // Preserve CHZZK's native 1080p row layout and replace only its existing
    // HD badge text. Nesting another badge inside the resolution prefix shifts
    // the label vertically and horizontally when PZP applies its own flex
    // rules, which is why the previous Kawaikara string looked misaligned.
    const nativeBadge = Array.from(item.querySelectorAll<HTMLElement>(
      '.pzp-ui-track-badge, .pzp-pc-ui-track-badge, [class*="track-badge"]',
    )).find((badge) =>
      /^(?:HD|Kawaikara)$/i.test(String(badge.textContent ?? '').trim()),
    );
    if (nativeBadge) {
      const badgeText =
        nativeBadge.querySelector<HTMLElement>(
          '.pzp-ui-track-badge__badge, em, [class*="badge__badge"]',
        ) ?? nativeBadge;
      nativeBadge.dataset.kawaikaraQualityNativeBadge = 'true';
      nativeBadge.dataset.kawaikaraOriginalBadgeText ||= 'HD';
      nativeBadge.style.removeProperty('display');
      badgeText.style.removeProperty('vertical-align');
      badgeText.textContent = 'Kawaikara';
      return;
    }

    // Defensive fallback for a future PZP revision without a separate badge.
    // Plain text keeps the native prefix's baseline instead of adding a nested
    // badge with incompatible layout rules.
    labelTarget.textContent = '1080p Kawaikara';
  };

  const ensureQualityPresentationStyle = (): void => {
    if (document.getElementById('kawaikara-chzzk-quality-style')) return;
    const style = document.createElement('style');
    style.id = 'kawaikara-chzzk-quality-style';
    style.textContent = `
      /* Retain the native selection column on the internal 480p row. */
      [data-kawaikara-internal-check="true"] {
        visibility: hidden !important;
      }
      [data-kawaikara-quality-bypass="1080"] {
        position: relative !important;
      }
      /*
       * PZP can restore the HD text with a character-data-only React update,
       * which does not recreate the quality row. Render the replacement from
       * the stable native badge element so it cannot regress to HD while the
       * menu is open.
       */
      [data-kawaikara-quality-native-badge="true"] {
        display: inline-flex !important;
        align-items: center !important;
        font-size: 0 !important;
      }
      [data-kawaikara-quality-native-badge="true"] > * {
        display: none !important;
      }
      [data-kawaikara-quality-native-badge="true"]::after {
        content: "Kawaikara" !important;
        font-size: 10px !important;
        line-height: 1 !important;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  };

  const isMenuItemSelected = (item: HTMLElement | null): boolean => {
    if (!item) return false;
    const values = [
      item.getAttribute('aria-checked'),
      item.getAttribute('aria-selected'),
      item.dataset.selected,
      item.dataset.active,
    ];
    if (values.some((value) => /^(?:1|true|selected|active)$/i.test(value ?? ''))) {
      return true;
    }
    if (/(?:^|[-_])(?:selected|active|checked)(?:$|[-_])/i.test(item.className)) {
      return true;
    }
    // PZP currently renders an otherwise empty check-image as the first child
    // of the selected quality row.
    const firstChild = item.firstElementChild;
    return Boolean(
      firstChild &&
        !String(firstChild.textContent ?? '').trim() &&
        (firstChild.matches('img, svg, [class*="check" i]') ||
          firstChild.querySelector('img, svg, [class*="check" i]')),
    );
  };

  const mirrorSelectedIndicator = (
    bypassItem: HTMLElement,
    sourceItem: HTMLElement,
  ): void => {
    bypassItem.dataset.kawaikaraQualityActive = 'true';
    bypassItem.dataset.kawaikaraQualityMirroredCheck = 'true';
    sourceItem.dataset.kawaikaraQualityInternalSource = 'true';
    // PZP renders the native check from its --checked class, not from ARIA.
    // Move that class away from the internal route (normally 480p) so the
    // public 1080p Kawaikara row owns the one and only visible check. The old
    // cloned marker is removed below because it produced a duplicate icon.
    for (const item of getQualityItems()) {
      item.classList.toggle(nativeQualityCheckedClass, item === bypassItem);
    }
    bypassItem.setAttribute('aria-checked', 'true');
    bypassItem.setAttribute('aria-selected', 'true');
    sourceItem.setAttribute('aria-checked', 'false');
    sourceItem.setAttribute('aria-selected', 'false');

    const sourceIndicator = sourceItem.firstElementChild;
    const hasNativeIndicator = Boolean(
      sourceIndicator &&
        !String(sourceIndicator.textContent ?? '').trim() &&
        (sourceIndicator.matches('img, svg, [class*="check" i]') ||
          sourceIndicator.querySelector('img, svg, [class*="check" i]')),
    );
    if (sourceIndicator && hasNativeIndicator) {
      sourceIndicator.setAttribute('data-kawaikara-internal-check', 'true');
    }
    for (const marker of bypassItem.querySelectorAll(
      '[data-kawaikara-quality-check]',
    )) {
      marker.remove();
    }
  };

  const clearSelectedIndicator = (
    bypassItem: HTMLElement | null,
    sourceItem: HTMLElement | null,
  ): void => {
    if (bypassItem) {
      delete bypassItem.dataset.kawaikaraQualityActive;
      if (bypassItem.dataset.kawaikaraQualityMirroredCheck === 'true') {
        bypassItem.classList.remove(nativeQualityCheckedClass);
        delete bypassItem.dataset.kawaikaraQualityMirroredCheck;
      }
      bypassItem.removeAttribute('aria-checked');
      bypassItem.removeAttribute('aria-selected');
      for (const marker of bypassItem.querySelectorAll(
        '[data-kawaikara-quality-check]',
      )) {
        marker.remove();
      }
    }
    if (!sourceItem) return;
    delete sourceItem.dataset.kawaikaraQualityInternalSource;
    // Do not clear native ARIA state here. CHZZK may already have committed a
    // user-selected 480p row while this cleanup is running.
    for (const indicator of sourceItem.querySelectorAll<HTMLElement>(
      '[data-kawaikara-internal-check]',
    )) {
      delete indicator.dataset.kawaikaraInternalCheck;
    }
  };

  const getNativeQualityLabel = (item: HTMLElement): string | undefined => {
    const text = String(item.textContent ?? '').replace(/\s+/g, ' ').trim();
    const match = /(?:^|\D)(360|480|720|1080)\s*p?(?:\D|$)/i.exec(text);
    return match ? `${match[1]}p` : undefined;
  };

  const getCurrentQualityLabelTargets = (): HTMLElement[] => {
    const targets = new Set<HTMLElement>();
    const candidates = document.querySelectorAll<HTMLElement>([
      '.pzp-pc-ui-setting-item__value',
      '.pzp-ui-setting-item__value',
      '[class*="setting-item__value"]',
      '[class*="quality-current"]',
      'li',
      '[role="menuitem"]',
    ].join(','));
    for (const candidate of candidates) {
      if (candidate.closest(qualityItemSelector)) continue;
      const text = String(candidate.textContent ?? '').replace(/\s+/g, ' ').trim();
      const isBypassSummary =
        candidate.dataset.kawaikaraQualitySummary === 'true';
      const isValue =
        /^(?:360|480|720|1080)\s*p?(?:\s*(?:HD|Kawaikara))?$/i.test(text);
      const isSettingRow =
        /^(?:Quality|화질)\s+(?:360|480|720|1080)\s*p?(?:\s*Kawaikara)?$/i.test(text);
      if (!isValue && !isSettingRow && !isBypassSummary) continue;
      const leaves = Array.from(candidate.querySelectorAll<HTMLElement>('*')).filter(
        (element) => {
          if (element.children.length > 0) return false;
          const leafText = String(element.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim();
          return (
            /^(?:360|480|720|1080)\s*p?(?:\s*(?:HD|Kawaikara))?$/i.test(leafText) ||
            /^(?:Quality|화질)\s+(?:360|480|720|1080)\s*p?(?:\s*Kawaikara)?$/i.test(leafText)
          );
        },
      );
      for (const target of
        leaves.length > 0
          ? leaves
          : isValue || isBypassSummary
            ? [candidate]
            : []) {
        targets.add(target);
      }
    }
    return Array.from(targets);
  };

  const writeCurrentQualityLabel = (
    value: string,
    markAsBypass: boolean,
  ): void => {
    for (const target of getCurrentQualityLabelTargets()) {
      if (markAsBypass) {
        target.dataset.kawaikaraQualitySummary = 'true';
      } else {
        delete target.dataset.kawaikaraQualitySummary;
      }
      const targetText = String(target.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      target.textContent = /^(?:Quality|화질)\s+/i.test(targetText)
        ? targetText.replace(/(?:360|480|720|1080)\s*p?(?:\s*(?:HD|Kawaikara))?$/i, value)
        : value;
    }
  };

  const updateCurrentQualityLabel = (): void => {
    writeCurrentQualityLabel('1080p Kawaikara', true);
  };

  const restoreCurrentQualityLabel = (): void => {
    for (const target of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-summary]',
    )) {
      // CHZZK owns native 360p/480p/720p labels. Do not restore a cached
      // string here: React reuses these nodes, so an old 480p snapshot can
      // overwrite a newly selected 720p or 360p value.
      delete target.dataset.kawaikaraQualitySummary;
    }
  };

  const updateQualityPresentation = (
    bypassItem: HTMLElement | null,
    sourceItem: HTMLElement | null,
  ): void => {
    ensureQualityPresentationStyle();
    if (!routeApplied) {
      restoreCurrentQualityLabel();
      clearSelectedIndicator(bypassItem, sourceItem);
      return;
    }
    updateCurrentQualityLabel();
    if (!bypassItem || !sourceItem) return;
    mirrorSelectedIndicator(bypassItem, sourceItem);
    updateCurrentQualityLabel();
  };

  const restoreQualityItems = (): void => {
    for (const item of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-bypass]',
    )) {
      const labelTarget = getItemLabelTarget(item);
      const original = item.dataset.kawaikaraOriginalQualityLabel;
      if (labelTarget && original) labelTarget.textContent = original;
      for (const badge of item.querySelectorAll<HTMLElement>(
        '[data-kawaikara-quality-native-badge]',
      )) {
        const badgeText =
          badge.querySelector<HTMLElement>(
            '.pzp-ui-track-badge__badge, em, [class*="badge__badge"]',
          ) ?? badge;
        badgeText.textContent = badge.dataset.kawaikaraOriginalBadgeText ?? 'HD';
        delete badge.dataset.kawaikaraQualityNativeBadge;
        delete badge.dataset.kawaikaraOriginalBadgeText;
      }
      delete item.dataset.kawaikaraOriginalQualityLabel;
      delete item.dataset.kawaikaraQualityActive;
      if (item.dataset.kawaikaraQualityMirroredCheck === 'true') {
        item.classList.remove(nativeQualityCheckedClass);
        delete item.dataset.kawaikaraQualityMirroredCheck;
      }
      delete item.dataset.kawaikaraQualityBypass;
      delete item.dataset.kawaikaraQualitySource;
      item.removeAttribute('aria-checked');
      item.removeAttribute('aria-selected');
      for (const marker of item.querySelectorAll(
        '[data-kawaikara-quality-check]',
      )) {
        marker.remove();
      }
    }
    for (const sourceItem of document.querySelectorAll<HTMLElement>(
      '[data-kawaikara-quality-internal-source]',
    )) {
      delete sourceItem.dataset.kawaikaraQualityInternalSource;
      for (const indicator of sourceItem.querySelectorAll<HTMLElement>(
        '[data-kawaikara-internal-check]',
      )) {
        delete indicator.dataset.kawaikaraInternalCheck;
      }
    }
  };

  const updateQualityMenu = (): {
    bypassItem: HTMLElement | null;
    sourceItem: HTMLElement | null;
  } => {
    let bypassItem: HTMLElement | null = null;
    let sourceItem: HTMLElement | null = null;
    for (const item of getQualityItems()) {
      const source = getItemSource(item);
      if (source === '480') sourceItem = item;
      if (source !== '1080') continue;
      bypassItem = item;
      decorateBypassItem(bypassItem);
    }
    updateQualityPresentation(bypassItem, sourceItem);
    return { bypassItem, sourceItem };
  };

  const getVisibleArea = (element: HTMLElement): number => {
    if (!element.isConnected) return 0;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    ) {
      return 0;
    }
    return rect.width * rect.height;
  };

  const getMainVideo = (): HTMLVideoElement | null => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const contentVideos = videos.filter((video) => {
      const source = video.currentSrc || video.src;
      return (
        !adVideoSourcePattern.test(source) &&
        !video.closest(adVideoContainerSelector)
      );
    });
    const candidates = contentVideos.length > 0 ? contentVideos : videos;
    candidates.sort((left, right) => getVisibleArea(right) - getVisibleArea(left));
    return candidates[0] ?? null;
  };

  const getTrackList = (target: unknown): ChzzkVideoTrackList | null => {
    const trackList = read<ChzzkVideoTrackList>(target, 'videoTracks');
    const length = Number(read<number>(trackList, 'length'));
    return trackList && Number.isFinite(length) && length > 0 ? trackList : null;
  };

  const collectTrackLists = (): ChzzkVideoTrackList[] => {
    const lists: ChzzkVideoTrackList[] = [];
    const seenTargets = new WeakSet<object>();
    const seenLists = new WeakSet<ChzzkVideoTrackList>();

    const addTarget = (target: unknown, depth: number): void => {
      if (
        target === null ||
        (typeof target !== 'object' && typeof target !== 'function')
      ) {
        return;
      }
      const objectTarget = target as object;
      if (seenTargets.has(objectTarget)) return;
      seenTargets.add(objectTarget);

      const list = getTrackList(target);
      if (list && !seenLists.has(list)) {
        seenLists.add(list);
        lists.push(list);
      }
      if (depth <= 0) return;
      for (const key of qualityTargetKeys) addTarget(read(target, key), depth - 1);
    };

    let ancestor: HTMLElement | null = getMainVideo();
    for (let depth = 0; ancestor && depth < 16; depth += 1) {
      addTarget(ancestor, 2);
      const root = ancestor.getRootNode();
      const shadowHost = root instanceof ShadowRoot ? root.host : null;
      ancestor =
        ancestor.parentElement ??
        (shadowHost instanceof HTMLElement ? shadowHost : null);
    }
    for (const player of document.querySelectorAll(playerSelector)) addTarget(player, 2);
    return lists;
  };

  const toTrackArray = (trackList: ChzzkVideoTrackList): ChzzkVideoTrack[] => {
    const tracks: ChzzkVideoTrack[] = [];
    const length = Number(read<number>(trackList, 'length')) || 0;
    for (let index = 0; index < length; index += 1) {
      const track =
        read<ChzzkVideoTrack>(trackList, index) ?? trackList.item?.(index);
      if (track) tracks.push(track);
    }
    return tracks;
  };

  const trackText = (track: ChzzkVideoTrack): string => {
    const parts: string[] = [];
    const add = (target: unknown, property: PropertyKey): void => {
      const value = read(target, property);
      if (value !== null && value !== undefined && value !== '') {
        parts.push(String(value));
      }
    };
    for (const property of [
      'id',
      'label',
      'quality',
      'qualityLabel',
      'videoQuality',
      'resolution',
      'height',
      'videoHeight',
      'encodingOptionID',
      'encodingOptionId',
      'src',
      'url',
    ]) {
      add(track, property);
    }
    const dataset = read(track, 'dataset');
    const attributes = read(track, 'attributes');
    for (const property of [
      'quality',
      'qualityLabel',
      'resolution',
      'height',
      'videoHeight',
    ]) {
      add(dataset, property);
      add(attributes, property);
    }
    add(attributes, 'RESOLUTION');
    return parts.join(' ').toLowerCase();
  };

  const is480Track = (track: ChzzkVideoTrack): boolean => {
    const height = Number(
      read(track, 'height') ?? read(track, 'videoHeight'),
    );
    if (height === 480) return true;
    const text = trackText(track);
    return (
      /(?:^|\D)480\s*p?(?:\D|$)/i.test(text) ||
      /\d{3,5}\s*x\s*480(?:\D|$)/i.test(text)
    );
  };

  const selectTrack = (
    trackList: ChzzkVideoTrackList,
    tracks: ChzzkVideoTrack[],
    targetTrack: ChzzkVideoTrack,
  ): boolean => {
    const targetIndex = tracks.indexOf(targetTrack);
    const wasPaused = getMainVideo()?.paused !== false;
    for (const track of tracks) {
      if (track === targetTrack) continue;
      try {
        if (read(track, 'selected')) track.selected = false;
      } catch {
        // Some player track implementations expose read-only properties.
      }
    }
    try {
      targetTrack.selected = true;
    } catch {
      // The selectedIndex and change-event paths below may still work.
    }
    try {
      if (targetIndex >= 0) trackList.selectedIndex = targetIndex;
    } catch {
      // Some CHZZK player revisions expose a read-only selectedIndex.
    }
    try {
      trackList.dispatchEvent?.(new Event('change'));
    } catch {
      // Selecting the track directly is enough on older player revisions.
    }

    const selectedIndex = Number(read(trackList, 'selectedIndex'));
    const selected =
      read(targetTrack, 'selected') === true ||
      (Number.isInteger(selectedIndex) && selectedIndex === targetIndex);
    if (selected && !wasPaused) {
      window.setTimeout(() => {
        void getMainVideo()?.play().catch(() => undefined);
      }, 120);
    }
    return selected;
  };

  const applyDefaultTrack = (): boolean => {
    if (routeApplied) return false;
    let foundTrackList = false;
    for (const trackList of collectTrackLists()) {
      if (appliedTrackLists.has(trackList)) continue;
      const tracks = toTrackArray(trackList);
      const bypassTrack = tracks.find(is480Track);
      if (!bypassTrack) continue;
      foundTrackList = true;
      if (selectTrack(trackList, tracks, bypassTrack)) {
        appliedTrackLists.add(trackList);
        routeApplied = true;
        logQuality('internal 480p route selected for the 1080p bypass', {
          method: 'videoTracks',
        });
        return true;
      }
    }
    return foundTrackList;
  };

  const activateInternalMenuItem = (
    sourceItem: HTMLElement | null,
    force = false,
  ): boolean => {
    if (!sourceItem) return false;
    if (isMenuItemSelected(sourceItem)) {
      routeApplied = true;
      if (!force) return true;
    }
    const now = Date.now();
    if (!force && now - lastMenuActivationAt < 500) return false;
    lastMenuActivationAt = now;
    try {
      sourceItem.focus({ preventScroll: true });
      // CHZZK's current React player handles keyboard activation more
      // consistently than HTMLElement.click() for a hidden/internal quality.
      sourceItem.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      sourceItem.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      sourceItem.click();
      routeApplied = true;
      logQuality('requested the internal 480p route', {
        method: 'keyboard+click',
      });
    } catch (error) {
      console.warn(
        `[Kawaikara/CHZZK][quality] internal quality activation failed: ${String(
          error,
        )}`,
      );
      return false;
    }
    return true;
  };

  const activateQualityBypass = (): void => {
    // A manual click must work even after the automatic initial selection.
    // Selecting CHZZK's internal 480p track is intentional: the Provider's
    // request hook replaces only that playlist URL with its 1080p counterpart.
    signalProviderBypass(true);
    routeApplied = false;
    defaultQualityPending = false;
    appliedTrackLists = new WeakSet<ChzzkVideoTrackList>();
    applyDefaultTrack();
    const { bypassItem, sourceItem } = updateQualityMenu();
    activateInternalMenuItem(sourceItem, true);
    updateQualityPresentation(bypassItem, sourceItem);
    logQuality('1080p Kawaikara selected by the user');
    scheduleRetryBurst();
  };

  const getBypassItemFromEvent = (event: Event): HTMLElement | null =>
    event.target instanceof Element
      ? event.target.closest<HTMLElement>(
          '[data-kawaikara-quality-bypass="1080"]',
        )
      : null;

  const onBypassClick = (event: MouseEvent): void => {
    if (!isLiveRoute() || !getBypassItemFromEvent(event)) return;
    // Capture at document level before CHZZK/React sees the locked 1080 row,
    // otherwise the original action can open its subscription UI.
    event.preventDefault();
    event.stopImmediatePropagation();
    activateQualityBypass();
  };

  const onBypassKeyDown = (event: KeyboardEvent): void => {
    if (
      !isLiveRoute() ||
      (event.key !== 'Enter' && event.key !== ' ') ||
      !getBypassItemFromEvent(event)
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    activateQualityBypass();
  };

  const onNativeQualityClick = (event: MouseEvent): void => {
    if (!isLiveRoute() || !(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>(qualityItemSelector);
    if (!item || item.dataset.kawaikaraQualityBypass === '1080') return;
    const nativeQualityLabel = getNativeQualityLabel(item);
    defaultQualityPending = false;
    signalProviderBypass(false);
    routeApplied = false;
    qualityVerified = false;
    decodedVideoWidth = 0;
    decodedVideoHeight = 0;
    const bypassItem = document.querySelector<HTMLElement>(
      '[data-kawaikara-quality-bypass="1080"]',
    );
    const sourceItem = getQualityItems().find(
      (qualityItem) => getItemSource(qualityItem) === '480',
    ) ?? null;
    clearSelectedIndicator(bypassItem, sourceItem);
    // React applies the clicked native quality after this capture listener.
    // Refresh only after that commit so CHZZK remains authoritative for its
    // 360p/480p/720p summary and selection marker.
    window.setTimeout(() => {
      // The bypass itself uses CHZZK's 480p state internally. Clicking the
      // visible native 480p row can therefore be a no-op from React's point of
      // view, leaving our old 1080p summary in place. Reconcile from the row
      // that the user actually clicked without caching a reusable DOM node.
      if (nativeQualityLabel) {
        writeCurrentQualityLabel(nativeQualityLabel, false);
      }
      scheduleRefresh();
    }, 0);
  };

  function attachVideo(video: HTMLVideoElement): void {
    if (attachedVideos.has(video)) return;
    attachedVideos.add(video);
    video.addEventListener('loadstart', onPlaybackSourceChanged, true);
    video.addEventListener('loadedmetadata', onPlaybackSourceChanged, true);
    video.addEventListener('loadedmetadata', scheduleResolutionVerification, true);
    video.addEventListener('loadeddata', scheduleRefresh, true);
    video.addEventListener('loadeddata', scheduleResolutionVerification, true);
    video.addEventListener('playing', scheduleRefresh, true);
    video.addEventListener('playing', scheduleResolutionVerification, true);
    video.addEventListener('resize', observeDecodedResolution, true);
    video.addEventListener('playing', clearPlaybackRecovery, true);
    video.addEventListener('canplay', clearPlaybackRecovery, true);
    video.addEventListener('waiting', schedulePlaybackRecovery, true);
    video.addEventListener('stalled', schedulePlaybackRecovery, true);
    video.addEventListener('error', schedulePlaybackRecovery, true);
  }

  const observeDecodedVideo = (video: HTMLVideoElement): void => {
    if (
      !isLiveRoute() ||
      video !== getMainVideo() ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }
    decodedVideoWidth = video.videoWidth;
    decodedVideoHeight = video.videoHeight;
    if (!bypassRequested || video.videoHeight < 1000 || qualityVerified) return;
    qualityVerified = true;
    routeApplied = true;
    defaultQualityPending = false;
    logQuality('decoded 1080p stream verified', {
      width: video.videoWidth,
      height: video.videoHeight,
    });
    scheduleRefresh();
  };

  function observeDecodedResolution(event: Event): void {
    const video = event.currentTarget;
    if (!(video instanceof HTMLVideoElement)) return;
    observeDecodedVideo(video);
  }

  function scheduleResolutionVerification(event: Event): void {
    const video = event.currentTarget;
    if (!(video instanceof HTMLVideoElement) || video !== getMainVideo()) return;
    observeDecodedResolution(event);
    if (resolutionVerificationTimer) window.clearTimeout(resolutionVerificationTimer);
    resolutionVerificationTimer = window.setTimeout(() => {
      resolutionVerificationTimer = 0;
      if (video !== getMainVideo()) return;
      observeDecodedVideo(video);
      if (!routeApplied || qualityVerified || decodedVideoHeight <= 0) return;
      console.warn(
        `[Kawaikara/CHZZK][quality] decoded stream is below the expected 1080p ${JSON.stringify(
          {
            width: decodedVideoWidth,
            height: decodedVideoHeight,
            automaticActivationAttempts,
          },
        )}`,
      );
      if (automaticActivationAttempts < maximumAutomaticActivationAttempts) {
        routeApplied = false;
        defaultQualityPending = true;
        appliedTrackLists = new WeakSet<ChzzkVideoTrackList>();
        scheduleRefresh();
        scheduleRetryBurst();
      } else {
        // Do not leave a false 1080p label behind if every real activation
        // attempt failed. The next player/source lifecycle can try again.
        routeApplied = false;
        scheduleRefresh();
      }
    }, 2500);
  }

  function clearPlaybackRecovery(event: Event): void {
    if (!(event.currentTarget instanceof HTMLVideoElement)) return;
    const timer = playbackRecoveryTimers.get(event.currentTarget);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    playbackRecoveryTimerIds.delete(timer);
    playbackRecoveryTimers.delete(event.currentTarget);
  }

  function schedulePlaybackRecovery(event: Event): void {
    const video = event.currentTarget;
    if (
      !(video instanceof HTMLVideoElement) ||
      !isLiveRoute() ||
      video !== getMainVideo() ||
      playbackRecoveryTimers.has(video)
    ) {
      return;
    }
    const scheduledAt = video.currentTime;
    console.warn(
      `[Kawaikara/CHZZK][playback] live video stalled ${JSON.stringify({
        event: event.type,
        readyState: video.readyState,
        networkState: video.networkState,
        paused: video.paused,
        error: video.error?.message ?? null,
      })}`,
    );
    const timer = window.setTimeout(() => {
      playbackRecoveryTimerIds.delete(timer);
      playbackRecoveryTimers.delete(video);
      if (
        !video.isConnected ||
        video !== getMainVideo() ||
        video.paused ||
        video.ended ||
        Math.abs(video.currentTime - scheduledAt) > 0.25
      ) {
        return;
      }
      try {
        // A stalled live MediaSource can retain a valid element while its
        // playhead sits behind the current seekable edge. Nudge only the main
        // live video; never reload the page or touch an intentionally paused
        // stream.
        if (video.seekable.length > 0) {
          const edge = video.seekable.end(video.seekable.length - 1);
          if (Number.isFinite(edge) && edge > video.currentTime + 0.25) {
            video.currentTime = Math.max(0, edge - 0.1);
          }
        }
        void video.play().catch((error: unknown) => {
          console.warn(
            `[Kawaikara/CHZZK][playback] recovery play failed: ${String(error)}`,
          );
        });
        console.info(
          `[Kawaikara/CHZZK][playback] live-edge recovery requested ${JSON.stringify(
            {
              readyState: video.readyState,
              currentTime: video.currentTime,
            },
          )}`,
        );
      } catch (error) {
        console.warn(
          `[Kawaikara/CHZZK][playback] recovery failed: ${String(error)}`,
        );
      }
    }, 6_000);
    playbackRecoveryTimers.set(video, timer);
    playbackRecoveryTimerIds.add(timer);
  }

  const refresh = (_force = false): void => {
    if (location.pathname !== routeKey) {
      routeKey = location.pathname;
      routeApplied = false;
      bypassRequested = false;
      lastBypassSignal = undefined;
      defaultQualityPending = true;
      qualityVerified = false;
      decodedVideoWidth = 0;
      decodedVideoHeight = 0;
      automaticActivationAttempts = 0;
      appliedTrackLists = new WeakSet<ChzzkVideoTrackList>();
    }
    if (!isLiveRoute()) {
      signalProviderBypass(false);
      restoreQualityItems();
      return;
    }

    ensureQualityPresentationStyle();

    for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
      attachVideo(video);
    }
    const { bypassItem, sourceItem } = updateQualityMenu();
    if (defaultQualityPending) {
      // Merely observing CHZZK's temporary selected row is not enough. The
      // internal 480p action must really fire so the Provider receives a 480p
      // media request and can redirect it to the 1080p playlist.
      signalProviderBypass(true);
      applyDefaultTrack();
      const activated =
        automaticActivationAttempts < maximumAutomaticActivationAttempts &&
        activateInternalMenuItem(sourceItem, true);
      if (activated) {
        automaticActivationAttempts += 1;
        defaultQualityPending = false;
      } else if (routeApplied && !sourceItem) {
        // videoTracks is the fallback for player revisions that do not retain
        // their quality rows in the closed settings pane.
        defaultQualityPending = false;
      }
    }
    updateQualityPresentation(bypassItem, sourceItem);
    if (routeApplied) {
      logQuality('1080p bypass route is active', {
        internalSource: '480p',
        displayedSource: '1080p',
        decodedHeight: decodedVideoHeight || null,
        verified: qualityVerified,
      });
    }
  };

  const scheduleRefresh = (): void => {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      refresh();
    }, 60);
  };

  const clearRetryTimers = (): void => {
    for (const timer of retryTimers) window.clearTimeout(timer);
    retryTimers.clear();
  };

  const scheduleRetryBurst = (): void => {
    clearRetryTimers();
    // Player internals are created asynchronously. This bounded burst replaces
    // a permanent interval and stops after the live player has settled.
    for (const delay of [100, 250, 500, 1000, 2000, 4000]) {
      const timer = window.setTimeout(() => {
        retryTimers.delete(timer);
        refresh();
      }, delay);
      retryTimers.add(timer);
    }
  };

  function onPlaybackSourceChanged(): void {
    scheduleRefresh();
    scheduleRetryBurst();
  }

  const relevantNodeSelector = [
    'video',
    playerSelector,
    qualityItemSelector,
    '[class*="setting"]',
    '[role="menuitem"]',
  ].join(',');
  const containsRelevantNode = (node: Node): boolean =>
    node instanceof Element &&
    (node.matches(relevantNodeSelector) || Boolean(node.querySelector(relevantNodeSelector)));

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!containsRelevantNode(node)) continue;
        scheduleRefresh();
        return;
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const onPageShow = (): void => {
    scheduleRefresh();
    scheduleRetryBurst();
  };
  window.addEventListener('pageshow', onPageShow, true);
  window.addEventListener('popstate', onPageShow, true);
  document.addEventListener('click', scheduleRefresh, true);
  document.addEventListener('click', onNativeQualityClick, true);
  document.addEventListener('click', onBypassClick, true);
  document.addEventListener('keydown', onBypassKeyDown, true);
  window.addEventListener(
    'beforeunload',
    () => {
      observer.disconnect();
      clearRetryTimers();
      if (resolutionVerificationTimer) {
        window.clearTimeout(resolutionVerificationTimer);
      }
      for (const timer of playbackRecoveryTimerIds) window.clearTimeout(timer);
      playbackRecoveryTimerIds.clear();
      document.removeEventListener('click', scheduleRefresh, true);
      document.removeEventListener('click', onNativeQualityClick, true);
      document.removeEventListener('click', onBypassClick, true);
      document.removeEventListener('keydown', onBypassKeyDown, true);
    },
    { once: true },
  );
  const diagnostics = (): Record<string, unknown> => ({
    href: location.href,
    liveRoute: isLiveRoute(),
    routeApplied,
    bypassRequested,
    defaultQualityPending,
    qualityVerified,
    automaticActivationAttempts,
    video: getMainVideo()
      ? {
          readyState: getMainVideo()!.readyState,
          paused: getMainVideo()!.paused,
          width: getMainVideo()!.videoWidth,
          height: getMainVideo()!.videoHeight,
        }
      : null,
  });
  pageGlobal.__kawaikaraChzzkQualityEnhancement = {
    refresh,
    observer,
    diagnostics,
  };
  logQuality('injection installed; default is 1080p Kawaikara');
  refresh();
  scheduleRetryBurst();
}

function installChzzkAdSkipper(): void {
  interface AdInjectionState {
    refresh(): void;
    observer: MutationObserver;
    diagnostics(): Record<string, unknown>;
  }

  interface AdRuntime {
    video: HTMLVideoElement;
    source: string;
    muted: boolean;
    mutedByKawaikara: boolean;
    playbackRate: number;
    playbackRateChanged: boolean;
    fastForwardStarted: boolean;
    fastForwardInterval?: number;
    fallbackTimer?: number;
    fallbackArmed: boolean;
    firstSeekLogged: boolean;
    ticks: number;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkAdSkipper?: AdInjectionState;
  };
  const installed = pageGlobal.__kawaikaraChzzkAdSkipper;
  if (installed) {
    installed.refresh();
    return;
  }

  const adSourcePattern = /(?:tvetamovie|glad-vod)[^/]*\.pstatic\.net/i;
  const adContainerSelector = [
    '[data-role="adVideoContainerEl"]',
    '[data-role*="ad-video" i]',
    '[class*="ad-video" i]',
    '[class*="advertisement-video" i]',
  ].join(',');
  const nativeSkipSelector = [
    'button.btn_skip',
    '[role="button"].btn_skip',
    '[data-role="skipBtn"]',
    '[data-role*="skip" i]',
    'button[class*="ad_skip" i]',
    'button[class*="skip_ad" i]',
    'button[class*="ad-skip" i]',
    'button[class*="skip-button" i]',
    'button[aria-label*="광고"][aria-label*="건너"]',
    'button[aria-label*="건너"]',
    '[role="button"][aria-label*="건너"]',
  ].join(',');
  const nativeSkipStatusSelector = [
    '.skip_info',
    '[class*="skip_info" i]',
  ].join(',');
  const nativeSkipCandidateSelector = [
    nativeSkipSelector,
    nativeSkipStatusSelector,
  ].join(',');
  const warningSelector = [
    '.popup_container__Aqx-3',
    '[class^="popup_container__"]',
    '[class*=" popup_container__"]',
    '[role="alertdialog"]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[class*="adblock" i]',
    '[class*="ad_block" i]',
    '[class*="ad-block" i]',
  ].join(',');
  const warningBackdropSelector = [
    '.popup_dimmed__zs78t',
    '[class^="popup_dimmed__"]',
    '[class*=" popup_dimmed__"]',
    '[class*="dimmed" i]',
    '[class*="backdrop" i]',
  ].join(',');
  const warningTextPattern = /(?:ad\s*block(?:er)?|광고\s*차단|광고.{0,40}확장.{0,40}(?:종료|비활성)|확장.{0,40}기능.{0,40}광고)/i;
  const hiddenWarningAttribute = 'data-kawaikara-adblock-warning';
  const warningStyleId = 'kawaikara-chzzk-adblock-warning-style';
  const attachedVideos = new WeakSet<HTMLVideoElement>();
  const sourceObservers = new WeakMap<HTMLVideoElement, MutationObserver>();
  const adRuntimes = new WeakMap<HTMLVideoElement, AdRuntime>();
  const activeAdVideos = new Set<HTMLVideoElement>();
  const observedShadowRoots = new WeakSet<ShadowRoot>();
  const searchableRoots = new Set<ParentNode>([document]);
  const confirmedAdSources = new WeakMap<HTMLVideoElement, string>();
  const fallbackButtonObservers = new WeakMap<HTMLElement, MutationObserver>();
  const fallbackButtonTimers = new WeakMap<HTMLElement, number>();
  const clickedFallbackButtons = new WeakSet<HTMLElement>();
  const fallbackButtonAttempts = new WeakMap<HTMLElement, number>();
  const fallbackScanTimers = new Set<number>();
  const fallbackScanDeadline = Date.now() + 45_000;
  let fallbackScanCount = 0;
  let detectedAdCount = 0;
  let clickedFallbackCount = 0;
  let hiddenWarningCount = 0;
  const mediaEvents = [
    'loadstart',
    'loadedmetadata',
    'durationchange',
    'progress',
    'canplay',
    'playing',
    'emptied',
    'ended',
  ] as const;

  const getComposedClosest = (
    element: Element,
    selector: string,
  ): HTMLElement | null => {
    let current: Element | null = element;
    for (let depth = 0; current && depth < 24; depth += 1) {
      if (current instanceof HTMLElement && current.matches(selector)) return current;
      if (current.parentElement) {
        current = current.parentElement;
        continue;
      }
      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? root.host : null;
    }
    return null;
  };

  const getAllRoots = (): ParentNode[] => Array.from(searchableRoots);

  const hasSeparateContentVideo = (adVideo: HTMLVideoElement): boolean =>
    getAllRoots().some((root) =>
      Array.from(root.querySelectorAll<HTMLVideoElement>('video')).some(
        (candidate) =>
          candidate !== adVideo &&
          !getComposedClosest(candidate, adContainerSelector) &&
          candidate.isConnected,
      ),
    );

  const getAdSource = (video: HTMLVideoElement): string => {
    if (video.ended) return '';
    const sources = [video.currentSrc, video.src];
    for (const source of video.querySelectorAll<HTMLSourceElement>('source[src]')) {
      sources.push(source.src);
    }
    const knownAdSource = sources.find(
      (source) => source && adSourcePattern.test(source),
    );
    if (knownAdSource) return knownAdSource;
    const sourceSignature = sources.filter(Boolean).join('|') || 'media-source';
    if (confirmedAdSources.get(video) === sourceSignature) {
      return `chzzk-ad-container:${sourceSignature}`;
    }

    // The current CHZZK player can feed an ad through MediaSource/blob URLs.
    // In that case its explicit adVideoContainer is stronger evidence than a
    // CDN hostname and avoids confusing the separate content video with an ad.
    const adContainer = getComposedClosest(video, adContainerSelector);
    const adIdentity = [
      video.className,
      video.getAttribute('data-role'),
      adContainer?.className,
      adContainer?.getAttribute('data-role'),
    ].join(' ');
    const adUiText = String(adContainer?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      adContainer &&
      (/\b(?:ad|advertisement)\b/i.test(adIdentity) ||
        /(?:광고|advertisement|sponsored)/i.test(adUiText) ||
        findNativeSkipButtons(adContainer).length > 0 ||
        hasSeparateContentVideo(video)) &&
      (sources.some(Boolean) ||
        video.srcObject !== null ||
        video.readyState > HTMLMediaElement.HAVE_NOTHING)
    ) {
      confirmedAdSources.set(video, sourceSignature);
      return `chzzk-ad-container:${sourceSignature}`;
    }
    return '';
  };

  const isNativeSkipButton = (element: HTMLElement): boolean => {
    if (element.matches(nativeSkipCandidateSelector)) return true;
    const label = `${element.getAttribute('aria-label') ?? ''} ${
      element.textContent ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
    return /(?:광고.{0,20}건너|건너.{0,20}광고|건너뛰기|skip\s*(?:this\s*)?ad)/i.test(label);
  };

  const findNativeSkipButtons = (root: ParentNode = document): HTMLElement[] => {
    const candidates = new Set<HTMLElement>();
    if (root instanceof HTMLElement && isNativeSkipButton(root)) {
      candidates.add(root);
    }
    for (const exact of root.querySelectorAll<HTMLElement>(
      nativeSkipCandidateSelector,
    )) {
      candidates.add(exact);
    }
    for (const candidate of root.querySelectorAll<HTMLElement>('button, [role="button"]')) {
      if (isNativeSkipButton(candidate)) candidates.add(candidate);
    }
    return Array.from(candidates);
  };

  const resolveNativeSkipTarget = (candidate: HTMLElement): HTMLElement => {
    if (
      candidate.matches(
        'button, [role="button"], [data-role="skipBtn"], .btn_skip',
      )
    ) {
      return candidate;
    }
    return (
      candidate.querySelector<HTMLElement>(
        'button, [role="button"], [data-role="skipBtn"], .btn_skip',
      ) ??
      candidate.closest<HTMLElement>(
        'button, [role="button"], [data-role="skipBtn"], .btn_skip',
      ) ??
      candidate
    );
  };

  const getNativeSkipLabel = (candidate: HTMLElement): string => {
    const informationArea = candidate.closest<HTMLElement>(
      '.ad_info_area, [data-role="adInfoArea"], [data-role="adBtnControlEl"]',
    );
    return `${candidate.getAttribute('aria-label') ?? ''} ${
      candidate.textContent ?? ''
    } ${informationArea?.textContent ?? ''}`
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isNativeSkipReady = (candidate: HTMLElement): boolean => {
    const button = resolveNativeSkipTarget(candidate);
    if (!candidate.isConnected || !button.isConnected || button.hidden) return false;
    const label = getNativeSkipLabel(candidate);
    if (!/(?:skip|건너)/i.test(label)) return false;
    // CHZZK exposes the future skip control throughout the countdown. Clicking
    // `15초 후 SKIP` is ignored but used to mark the old fallback as complete,
    // so wait until the countdown text has actually disappeared.
    if (
      /(?:\d+\s*(?:초|s(?:ec(?:ond)?s?)?)\s*(?:후|뒤|left|remaining)?\s*skip)|(?:skip\s*(?:in|after)?\s*\d+)/i.test(
        label,
      )
    ) {
      return false;
    }
    // CHZZK creates `.btn_skip.hide` up front, but its click handler ignores
    // clicks until the player removes `hide` and enters SKIPPABLE state.
    if (candidate.classList.contains('hide') || button.classList.contains('hide')) {
      return false;
    }
    if (button.getAttribute('aria-disabled') === 'true') return false;
    if (button instanceof HTMLButtonElement && button.disabled) return false;
    const candidateStyle = getComputedStyle(candidate);
    const buttonStyle = getComputedStyle(button);
    return (
      candidateStyle.display !== 'none' &&
      candidateStyle.visibility !== 'hidden' &&
      buttonStyle.display !== 'none' &&
      buttonStyle.visibility !== 'hidden'
    );
  };

  const stopWatchingFallbackButton = (button: HTMLElement): void => {
    fallbackButtonObservers.get(button)?.disconnect();
    fallbackButtonObservers.delete(button);
  };

  const watchFallbackButton = (candidate: HTMLElement): void => {
    if (fallbackButtonObservers.has(candidate)) return;
    const buttonObserver = new MutationObserver(() => {
      if (!candidate.isConnected) {
        stopWatchingFallbackButton(candidate);
        return;
      }
      if (!isNativeSkipReady(candidate)) {
        // CHZZK commonly reuses the same skip element for later mid-rolls.
        // Hidden/countdown state marks a new ad cycle and rearms all retries.
        clickedFallbackButtons.delete(candidate);
        fallbackButtonAttempts.delete(candidate);
        return;
      }
      clickNativeSkipButton(candidate);
    });
    const observationTarget =
      candidate.closest<HTMLElement>(
        '.ad_info_area, [data-role="adInfoArea"], [data-role="adBtnControlEl"]',
      ) ?? candidate;
    buttonObserver.observe(observationTarget, {
      attributes: true,
      attributeFilter: ['aria-disabled', 'class', 'disabled', 'hidden', 'style'],
      characterData: true,
      childList: true,
      subtree: true,
    });
    fallbackButtonObservers.set(candidate, buttonObserver);
  };

  const clickNativeSkipButton = (candidate: HTMLElement): boolean => {
    if (!candidate.isConnected) {
      stopWatchingFallbackButton(candidate);
      return false;
    }
    watchFallbackButton(candidate);
    if (!isNativeSkipReady(candidate)) {
      clickedFallbackButtons.delete(candidate);
      fallbackButtonAttempts.delete(candidate);
      return false;
    }
    if (clickedFallbackButtons.has(candidate)) return true;
    const attempt = (fallbackButtonAttempts.get(candidate) ?? 0) + 1;
    if (attempt > 3) return false;

    const button = resolveNativeSkipTarget(candidate);
    clickedFallbackButtons.add(candidate);
    fallbackButtonAttempts.set(candidate, attempt);
    clickedFallbackCount += 1;
    console.info(
      `[Kawaikara/CHZZK][ad] native skip fallback is ready; clicking ${JSON.stringify(
        {
          text: getNativeSkipLabel(candidate),
          className: button.className,
          attempt,
        },
      )}`,
    );
    try {
      const eventInit: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
      };
      if (typeof PointerEvent === 'function') {
        button.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        button.dispatchEvent(new PointerEvent('pointerup', eventInit));
      }
      button.dispatchEvent(new MouseEvent('mousedown', eventInit));
      button.dispatchEvent(new MouseEvent('mouseup', eventInit));
      button.click();
      window.setTimeout(() => {
        if (!candidate.isConnected || !isNativeSkipReady(candidate)) return;
        // A player transition can temporarily ignore the first synthetic
        // click. Retry a ready button at most three times; successful skips
        // remove the element and naturally cancel this path.
        clickedFallbackButtons.delete(candidate);
        clickNativeSkipButton(candidate);
      }, 750);
    } catch (error) {
      console.warn(
        `[Kawaikara/CHZZK][ad] native skip fallback click failed: ${String(error)}`,
      );
      return false;
    }
    return true;
  };

  const scheduleNativeSkipFallback = (button: HTMLElement): void => {
    if (
      clickedFallbackButtons.has(button) ||
      fallbackButtonTimers.has(button)
    ) {
      return;
    }
    // This path deliberately does not depend on video URL detection. If CHZZK
    // changes its ad CDN, the site's own skip button remains a usable fallback.
    const timer = window.setTimeout(() => {
      fallbackButtonTimers.delete(button);
      clickNativeSkipButton(button);
    }, 250);
    fallbackButtonTimers.set(button, timer);
  };

  const clearAdRuntime = (
    video: HTMLVideoElement,
    reason = 'ad source is no longer active',
  ): void => {
    const runtime = adRuntimes.get(video);
    if (!runtime) return;
    if (runtime.fastForwardInterval !== undefined) {
      window.clearInterval(runtime.fastForwardInterval);
    }
    if (runtime.fallbackTimer !== undefined) {
      window.clearTimeout(runtime.fallbackTimer);
    }
    if (runtime.mutedByKawaikara && video.muted) video.muted = runtime.muted;
    if (runtime.playbackRateChanged && video.playbackRate !== runtime.playbackRate) {
      try {
        video.playbackRate = runtime.playbackRate;
      } catch {
        // The ad element is normally removed before cleanup.
      }
    }
    if (runtime.fastForwardStarted) {
      console.info(
        `[Kawaikara/CHZZK][ad] fast-forward stopped ${JSON.stringify({
          reason,
          ticks: runtime.ticks,
          currentTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
          duration: Number.isFinite(video.duration) ? video.duration : null,
        })}`,
      );
    }
    activeAdVideos.delete(video);
    adRuntimes.delete(video);
  };

  const tryNativeSkipFallback = (
    runtime: AdRuntime,
    candidate?: HTMLElement,
  ): void => {
    if (!runtime.fallbackArmed) return;
    if (adRuntimes.get(runtime.video) !== runtime) return;
    if (getAdSource(runtime.video) !== runtime.source) {
      clearAdRuntime(runtime.video);
      return;
    }

    const buttons = candidate && isNativeSkipButton(candidate)
      ? [candidate]
      : getAllRoots().flatMap((root) => findNativeSkipButtons(root));
    const button = buttons.find(isNativeSkipReady) ?? buttons[0];
    if (button) clickNativeSkipButton(button);
  };

  const armNativeSkipFallback = (runtime: AdRuntime): void => {
    if (adRuntimes.get(runtime.video) !== runtime) return;
    if (getAdSource(runtime.video) !== runtime.source) {
      clearAdRuntime(runtime.video);
      return;
    }

    // Seeking is the primary path. The native button is only enabled after the
    // ad source survives long enough to show that the seek did not finish it.
    runtime.fallbackArmed = true;
    tryNativeSkipFallback(runtime);
  };

  const hasUsableAdTimeline = (video: HTMLVideoElement): boolean => {
    if (Number.isFinite(video.duration) && video.duration > 0) return true;
    try {
      return video.seekable.length > 0;
    } catch {
      return false;
    }
  };

  const advanceAdVideo = (runtime: AdRuntime): void => {
    const { video } = runtime;
    if (
      adRuntimes.get(video) !== runtime ||
      getAdSource(video) !== runtime.source ||
      !video.isConnected
    ) {
      clearAdRuntime(video);
      return;
    }

    try {
      if (runtime.mutedByKawaikara) video.muted = true;
      if (video.playbackRate < 16) {
        try {
          video.playbackRate = 16;
          runtime.playbackRateChanged = true;
        } catch {
          // Direct seeking below remains the primary path.
        }
      }
      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      let seekTarget: number | undefined;
      // Preserve the proven userscript behavior exactly: advance by ten
      // seconds per tick and allow the media element to clamp a seek past the
      // end. Seeking to duration - epsilon is not equivalent on CHZZK because
      // it can leave the ad state machine waiting without emitting `ended`.
      if (
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        currentTime < video.duration
      ) {
        seekTarget = currentTime + 10;
      } else if (video.seekable.length > 0) {
        const seekableEnd = video.seekable.end(video.seekable.length - 1);
        if (seekableEnd > currentTime) seekTarget = currentTime + 10;
      }
      if (seekTarget !== undefined) {
        video.currentTime = seekTarget;
        if (!runtime.firstSeekLogged) {
          runtime.firstSeekLogged = true;
          console.info(
            `[Kawaikara/CHZZK][ad] first fast-forward seek applied ${JSON.stringify(
              {
                from: currentTime,
                requested: seekTarget,
                accepted: Number.isFinite(video.currentTime)
                  ? video.currentTime
                  : null,
                duration: Number.isFinite(video.duration) ? video.duration : null,
              },
            )}`,
          );
        }
      }
      void video.play().catch(() => undefined);
    } catch {
      // The next media event or fast-forward tick retries the seek.
    }
  };

  const startFastForwardBurst = (runtime: AdRuntime): void => {
    if (runtime.fastForwardInterval !== undefined) return;
    // `loadstart` commonly identifies the ad while duration is still NaN and
    // readyState is HAVE_NOTHING. Do not consume a timeout window here. Media
    // events call performSkip again as soon as the timeline becomes seekable.
    if (!hasUsableAdTimeline(runtime.video)) return;
    runtime.fastForwardStarted = true;
    console.info(
      `[Kawaikara/CHZZK][ad] metadata ready; starting fast-forward ${JSON.stringify(
        {
          readyState: runtime.video.readyState,
          currentTime: Number.isFinite(runtime.video.currentTime)
            ? runtime.video.currentTime
            : null,
          duration: Number.isFinite(runtime.video.duration)
            ? runtime.video.duration
            : null,
        },
      )}`,
    );
    // The original working integration repeatedly advanced by ten seconds.
    // CHZZK can undo a single large seek, so repeat it, only while a
    // positively identified ad source is attached. This is not a global poll.
    runtime.fastForwardInterval = window.setInterval(() => {
      runtime.ticks += 1;
      advanceAdVideo(runtime);
    }, 50);
    advanceAdVideo(runtime);
  };

  const performSkip = (video: HTMLVideoElement): void => {
    const source = getAdSource(video);
    if (!source || !video.isConnected) {
      clearAdRuntime(video);
      return;
    }

    let runtime = adRuntimes.get(video);
    if (!runtime || runtime.source !== source) {
      clearAdRuntime(video);
      runtime = {
        video,
        source,
        muted: video.muted,
        mutedByKawaikara: !video.muted,
        playbackRate: video.playbackRate,
        playbackRateChanged: false,
        fastForwardStarted: false,
        fallbackArmed: false,
        firstSeekLogged: false,
        ticks: 0,
      };
      adRuntimes.set(video, runtime);
      activeAdVideos.add(video);
      detectedAdCount += 1;
      console.info(
        `[Kawaikara/CHZZK][ad] ad detected; waiting for seekable metadata ${JSON.stringify(
          {
            source,
            readyState: video.readyState,
            duration: video.duration,
          },
        )}`,
      );
      runtime.fallbackTimer = window.setTimeout(() => {
        runtime!.fallbackTimer = undefined;
        armNativeSkipFallback(runtime!);
      }, 800);
    }
    startFastForwardBurst(runtime);
    advanceAdVideo(runtime);
  };

  const inspectVideo = (video: HTMLVideoElement): void => {
    if (getAdSource(video)) performSkip(video);
    else clearAdRuntime(video);
  };

  const onMediaChanged = (event: Event): void => {
    if (event.currentTarget instanceof HTMLVideoElement) {
      inspectVideo(event.currentTarget);
    }
  };

  const attachVideo = (video: HTMLVideoElement): void => {
    if (attachedVideos.has(video)) return;
    attachedVideos.add(video);
    for (const eventName of mediaEvents) {
      video.addEventListener(eventName, onMediaChanged, true);
    }

    const sourceObserver = new MutationObserver(() => inspectVideo(video));
    sourceObserver.observe(video, {
      attributes: true,
      attributeFilter: ['src'],
      childList: true,
      subtree: true,
    });
    sourceObservers.set(video, sourceObserver);
    inspectVideo(video);
  };

  const detachVideo = (video: HTMLVideoElement): void => {
    for (const eventName of mediaEvents) {
      video.removeEventListener(eventName, onMediaChanged, true);
    }
    attachedVideos.delete(video);
    sourceObservers.get(video)?.disconnect();
    sourceObservers.delete(video);
    clearAdRuntime(video);
  };

  const ensureAdBlockWarningStyle = (): void => {
    if (document.getElementById(warningStyleId)) return;
    const style = document.createElement('style');
    style.id = warningStyleId;
    style.textContent = `
      [${hiddenWarningAttribute}="hidden"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  };

  const isRenderedWarningCandidate = (element: HTMLElement): boolean => {
    if (element.getAttribute(hiddenWarningAttribute) === 'hidden') return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const findWarningBackdrop = (popup: HTMLElement): HTMLElement | null => {
    const direct = popup.closest<HTMLElement>(warningBackdropSelector);
    if (direct) return direct;
    for (
      let parent = popup.parentElement;
      parent && parent !== document.body && parent !== document.documentElement;
      parent = parent.parentElement
    ) {
      const className = String(parent.className ?? '');
      if (/(?:dimmed|backdrop)/i.test(className)) return parent;
    }
    return null;
  };

  const unlockBodyAfterWarning = (): void => {
    const delays = [0, 80, 250, 800];
    for (const delay of delays) {
      window.setTimeout(() => {
        const hasOtherDialog = Array.from(
          document.querySelectorAll<HTMLElement>(warningSelector),
        ).some(isRenderedWarningCandidate);
        if (hasOtherDialog || !document.body) return;
        if (document.body.style.overflow === 'hidden') {
          document.body.style.removeProperty('overflow');
        }
        if (document.body.style.overflowY === 'hidden') {
          document.body.style.removeProperty('overflow-y');
        }
        document.body.style.removeProperty('padding-right');
        if (!document.body.getAttribute('style')?.trim()) {
          document.body.removeAttribute('style');
        }
      }, delay);
    }
  };

  const hideAdBlockWarning = (element: HTMLElement): void => {
    if (element.getAttribute(hiddenWarningAttribute) === 'hidden') return;
    const text = String(element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!warningTextPattern.test(text) || text.length > 2000) return;
    ensureAdBlockWarningStyle();
    element.setAttribute(hiddenWarningAttribute, 'hidden');
    findWarningBackdrop(element)?.setAttribute(hiddenWarningAttribute, 'hidden');
    hiddenWarningCount += 1;
    console.info(
      `[Kawaikara/CHZZK][ad:block] suppressed anti-adblock warning ${JSON.stringify({
        count: hiddenWarningCount,
      })}`,
    );
    unlockBodyAfterWarning();
  };

  function observeShadowRoot(root: ShadowRoot): void {
    if (observedShadowRoots.has(root)) return;
    observedShadowRoots.add(root);
    searchableRoots.add(root);
    observer.observe(root, { childList: true, subtree: true });
    for (const child of root.children) inspectNode(child);
  }

  function inspectNode(node: Node): void {
    // Text inside an existing button can be replaced without adding a new
    // Element. Inspect its parent as well so a late "광고 건너뛰기" label is seen.
    const element = node instanceof Element ? node : node.parentElement;
    if (!element) return;

    const containingVideo =
      element instanceof HTMLVideoElement
        ? element
        : element.closest<HTMLVideoElement>('video');
    if (containingVideo) attachVideo(containingVideo);
    for (const video of element.querySelectorAll<HTMLVideoElement>('video')) {
      attachVideo(video);
    }

    if (element instanceof HTMLElement && element.matches(warningSelector)) {
      hideAdBlockWarning(element);
    }
    for (const warning of element.querySelectorAll<HTMLElement>(warningSelector)) {
      hideAdBlockWarning(warning);
    }

    // Once fallback is armed, newly-created native skip buttons are handled by
    // this existing DOM observer; no high-frequency document polling is needed.
    const nativeSkipButtons = findNativeSkipButtons(element);
    for (const nativeSkipButton of nativeSkipButtons) {
      scheduleNativeSkipFallback(nativeSkipButton);
      for (const video of activeAdVideos) {
        const runtime = adRuntimes.get(video);
        if (runtime) tryNativeSkipFallback(runtime, nativeSkipButton);
      }
    }

    // CHZZK's current player mounts its adVideoContainer, ad <video>, and
    // btn_skip inside open Shadow DOM. A document-only observer cannot see any
    // of them, so discover every open root and observe its mutations directly.
    if (element.shadowRoot) observeShadowRoot(element.shadowRoot);
    for (const possibleHost of element.querySelectorAll<HTMLElement>('*')) {
      if (possibleHost.shadowRoot) observeShadowRoot(possibleHost.shadowRoot);
    }
  }

  const scanForNativeSkipButtons = (): void => {
    fallbackScanCount += 1;
    let found = false;
    for (const root of getAllRoots()) {
      for (const button of findNativeSkipButtons(root)) {
        found = true;
        scheduleNativeSkipFallback(button);
        for (const video of activeAdVideos) {
          const runtime = adRuntimes.get(video);
          if (runtime) tryNativeSkipFallback(runtime, button);
        }
      }
    }
    if (found) {
      console.debug(
        `[Kawaikara/CHZZK][ad] native skip fallback discovered ${JSON.stringify({
          scan: fallbackScanCount,
        })}`,
      );
    }
  };

  const scheduleStartupFallbackScan = (): void => {
    if (Date.now() >= fallbackScanDeadline) return;
    const timer = window.setTimeout(() => {
      fallbackScanTimers.delete(timer);
      scanForNativeSkipButtons();
      scheduleStartupFallbackScan();
    }, 500);
    fallbackScanTimers.add(timer);
  };

  const resetRemovedNode = (node: Node): void => {
    if (!(node instanceof Element)) return;
    for (const button of findNativeSkipButtons(node)) {
      stopWatchingFallbackButton(button);
      const timer = fallbackButtonTimers.get(button);
      if (timer !== undefined) window.clearTimeout(timer);
      fallbackButtonTimers.delete(button);
      clickedFallbackButtons.delete(button);
      fallbackButtonAttempts.delete(button);
    }
    if (node instanceof HTMLVideoElement) detachVideo(node);
    for (const video of node.querySelectorAll<HTMLVideoElement>('video')) detachVideo(video);
    if (node.shadowRoot) {
      for (const video of node.shadowRoot.querySelectorAll<HTMLVideoElement>('video')) {
        detachVideo(video);
      }
    }
    for (const possibleHost of node.querySelectorAll<HTMLElement>('*')) {
      if (!possibleHost.shadowRoot) continue;
      for (const video of possibleHost.shadowRoot.querySelectorAll<HTMLVideoElement>(
        'video',
      )) {
        detachVideo(video);
      }
    }
  };

  const refresh = (): void => {
    ensureAdBlockWarningStyle();
    inspectNode(document.documentElement);
    scanForNativeSkipButtons();
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) resetRemovedNode(node);
      for (const node of record.addedNodes) inspectNode(node);
      if (record.type === 'attributes' || record.type === 'characterData') {
        inspectNode(record.target);
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-modal', 'class', 'role', 'style'],
    characterData: true,
    childList: true,
    subtree: true,
  });
  const diagnostics = (): Record<string, unknown> => ({
    href: location.href,
    detectedAdCount,
    activeAdVideos: activeAdVideos.size,
    clickedFallbackCount,
    fallbackScanCount,
    hiddenWarningCount,
  });
  window.addEventListener(
    'beforeunload',
    () => {
      observer.disconnect();
      for (const timer of fallbackScanTimers) window.clearTimeout(timer);
      fallbackScanTimers.clear();
    },
    { once: true },
  );
  pageGlobal.__kawaikaraChzzkAdSkipper = { refresh, observer, diagnostics };
  console.info(
    `[Kawaikara/CHZZK][ad] skipper installed ${JSON.stringify({
      startupFallbackWindowMs: 45_000,
    })}`,
  );
  refresh();
  scheduleStartupFallbackScan();
}

export function createChzzkQualityEnhancementScript(
  options: ChzzkQualityInjectionOptions,
): string {
  return serializePageInjectionWithOptions(
    installChzzkQualityEnhancement,
    options,
  );
}

export const CHZZK_AD_RESPONSE_BLOCKER_SCRIPT = serializePageInjection(
  installChzzkAdResponseBlocker,
);

export const CHZZK_AD_SKIPPER_SCRIPT = serializePageInjection(
  installChzzkAdSkipper,
);
