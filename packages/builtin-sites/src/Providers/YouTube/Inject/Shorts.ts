import { serializePageInjectionWithOptions } from '../../../Inject/Serialize';

export interface YouTubeShortsInjectionOptions {
  readonly autoAdvance: boolean;
  readonly bannedPublishers: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly announce: boolean;
  readonly labels: {
    readonly enabled: string;
    readonly disabled: string;
    readonly banned: string;
    readonly next: string;
    readonly previous: string;
  };
}

export type YouTubeShortsCommand = 'next' | 'previous' | 'announce' | 'ban';

interface YouTubeShortsCommandOptions {
  readonly command: YouTubeShortsCommand;
}

/**
 * This entire function executes in YouTube's page world. Keep it self-contained
 * so TypeScript can check DOM access before it is serialized.
 */
function installYouTubeShorts(options: YouTubeShortsInjectionOptions): void {
  interface ShortsPublisher {
    readonly id: string;
    readonly label: string;
    readonly handle?: string;
    readonly imageUrl?: string;
    readonly aliases?: readonly string[];
  }

  interface ProgressSnapshot {
    readonly currentTime: number;
    readonly duration: number;
    readonly generation: number;
    readonly observedAt: number;
    readonly url: string;
  }

  interface ShortsState {
    autoAdvance: boolean;
    advancing: boolean;
    lastAdvancedUrl?: string;
    progressGeneration: number;
    readonly progressByVideo: WeakMap<HTMLVideoElement, ProgressSnapshot>;
    readonly labels: {
      enabled: string;
      disabled: string;
      banned: string;
      next: string;
      previous: string;
    };
    readonly bannedPublisherIds: Set<string>;
    resolveActivePublisher(): Promise<ShortsPublisher | undefined>;
    checkBannedPublisher(): Promise<void>;
    navigate(direction: 'next' | 'previous'): boolean;
    setAutoAdvance(enabled: boolean, announce: boolean): void;
    showActionStatus(message: string, icon?: string): void;
    showAutoAdvanceStatus(): void;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraYouTubeShorts?: ShortsState;
    __kawaikaraUnifiedPictureInPicture?: {
      releaseLayoutForNavigation?(): void;
      restoreLayoutAfterNavigation?(): void;
    };
  };
  const installed = pageGlobal.__kawaikaraYouTubeShorts;
  if (installed) {
    installed.labels.enabled = options.labels.enabled;
    installed.labels.disabled = options.labels.disabled;
    installed.labels.banned = options.labels.banned;
    installed.labels.next = options.labels.next;
    installed.labels.previous = options.labels.previous;
    installed.bannedPublisherIds.clear();
    options.bannedPublishers.forEach(({ id, label }) => {
      installed.bannedPublisherIds.add(id);
      if (label.startsWith('@')) {
        installed.bannedPublisherIds.add(`handle:${label.toLowerCase()}`);
      }
    });
    installed.setAutoAdvance(options.autoAdvance, options.announce);
    void installed.checkBannedPublisher();
    return;
  }

  const progressByVideo = new WeakMap<HTMLVideoElement, ProgressSnapshot>();
  const labels = { ...options.labels };
  let statusTimer: number | undefined;
  const publisherByHandle = new Map<string, ShortsPublisher>();

  const isShortsPage = (): boolean =>
    /^\/shorts\/[^/?#]+\/?$/.test(location.pathname);

  const visibleRatio = (element: Element): number => {
    const rect = element.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
    );
    const area = rect.width * rect.height;
    return area > 0 ? (visibleWidth * visibleHeight) / area : 0;
  };

  const isActiveShortsVideo = (candidate: unknown): candidate is HTMLVideoElement =>
    candidate instanceof HTMLVideoElement &&
    candidate.isConnected &&
    candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    visibleRatio(candidate) >= 0.5;

  const findActiveRenderer = (): Element | undefined =>
    document.querySelector('ytd-reel-video-renderer[is-active]') ??
    [...document.querySelectorAll('ytd-reel-video-renderer')].find(
      (renderer) => visibleRatio(renderer) >= 0.5,
    );

  const resolveImageUrl = (
    scope: Element | Document,
    anchor: HTMLAnchorElement,
  ): string | undefined => {
    const candidates = new Set<HTMLImageElement>();
    for (const image of anchor.querySelectorAll<HTMLImageElement>('img')) {
      candidates.add(image);
    }
    for (const image of scope.querySelectorAll<HTMLImageElement>([
      '#avatar img',
      'yt-avatar-shape img',
      'yt-img-shadow img',
      'img[alt*="channel" i]',
      'img[alt*="채널" i]',
    ].join(','))) {
      candidates.add(image);
    }

    const anchorRect = anchor.getBoundingClientRect();
    return [...candidates]
      .map((image) => {
        const url = image.currentSrc || image.src;
        if (!url.startsWith('https://') || visibleRatio(image) <= 0) return undefined;
        const rect = image.getBoundingClientRect();
        const horizontalDistance = Math.abs(
          rect.left + rect.width / 2 - (anchorRect.left + anchorRect.width / 2),
        );
        const verticalDistance = Math.abs(
          rect.top + rect.height / 2 - (anchorRect.top + anchorRect.height / 2),
        );
        return { url, distance: horizontalDistance + verticalDistance };
      })
      .filter((candidate): candidate is { url: string; distance: number } =>
        candidate !== undefined,
      )
      .sort((left, right) => left.distance - right.distance)[0]?.url;
  };

  const resolveActivePublisher = async (): Promise<ShortsPublisher | undefined> => {
    if (!isShortsPage()) return undefined;
    const renderer = findActiveRenderer();
    const activeVideo = [...document.querySelectorAll<HTMLVideoElement>('video')]
      .find(isActiveShortsVideo);
    // Some Shorts revisions do not mark or retain a reel renderer around the
    // active video. Fall back to its main surface; the distance-scored avatar
    // lookup still selects the publisher image instead of the audio artwork.
    const scope = renderer ?? activeVideo?.closest('main') ?? document;
    const anchors = scope.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/@"], a[href^="/channel/"]',
    );
    const anchor = [...anchors].find((candidate) => {
      const path = new URL(candidate.href, location.origin).pathname;
      return /^\/(?:@[^/]+|channel\/UC[^/]+)(?:\/|$)/i.test(path);
    });
    if (!anchor) return undefined;

    const url = new URL(anchor.href, location.origin);
    const channelMatch = /^\/channel\/(UC[^/]+)/i.exec(url.pathname);
    const label = (anchor.textContent ?? '').trim() || url.pathname.split('/')[1] || '';
    const currentImageUrl = resolveImageUrl(scope, anchor);
    if (channelMatch) {
      return {
        id: channelMatch[1],
        label: label || channelMatch[1],
        imageUrl: currentImageUrl,
      };
    }

    const handle = /^\/(@[^/]+)/.exec(url.pathname)?.[1];
    if (!handle) return undefined;
    const key = handle.toLowerCase();
    const handleId = `handle:${key}`;
    if (pageGlobal.__kawaikaraYouTubeShorts?.bannedPublisherIds.has(handleId)) {
      return {
        id: handleId,
        label: label || handle,
        handle,
        imageUrl: currentImageUrl,
      };
    }
    const cached = publisherByHandle.get(key);
    if (cached) {
      if (cached.imageUrl || !currentImageUrl) return cached;
      const enriched = { ...cached, imageUrl: currentImageUrl };
      publisherByHandle.set(key, enriched);
      return enriched;
    }

    let id = handleId;
    let displayLabel = label || handle;
    let imageUrl = currentImageUrl;
    try {
      const response = await fetch(`/${handle}`, { credentials: 'include' });
      if (response.ok) {
        const html = await response.text();
        const channelDocument = new DOMParser().parseFromString(html, 'text/html');
        const title = channelDocument.querySelector<HTMLMetaElement>(
          'meta[property="og:title"]',
        )?.content.trim();
        const image = channelDocument.querySelector<HTMLMetaElement>(
          'meta[property="og:image"]',
        )?.content.trim();
        if (title) displayLabel = title;
        if (image?.startsWith('https://')) imageUrl = image;
        const stableId =
          /["']externalId["']\s*:\s*["'](UC[A-Za-z0-9_-]+)["']/.exec(html)?.[1] ??
          /["']channelId["']\s*:\s*["'](UC[A-Za-z0-9_-]+)["']/.exec(html)?.[1];
        if (stableId) id = stableId;
      }
    } catch {
      // The handle remains a stable-enough fallback when YouTube rejects the
      // same-origin channel lookup or the viewer is temporarily offline.
    }
    const publisher = {
      id,
      label: displayLabel,
      handle,
      imageUrl,
      aliases: id === handleId ? undefined : [handleId],
    };
    publisherByHandle.set(key, publisher);
    return publisher;
  };

  const findNavigationButton = (
    direction: 'next' | 'previous',
  ): HTMLButtonElement | undefined => {
    const selectors = direction === 'next'
      ? [
          'ytd-shorts #navigation-button-down button',
          'ytd-shorts button[aria-label*="Next" i]',
          'ytd-shorts button[aria-label*="다음" i]',
        ]
      : [
          'ytd-shorts #navigation-button-up button',
          'ytd-shorts button[aria-label*="Previous" i]',
          'ytd-shorts button[aria-label*="이전" i]',
        ];
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button instanceof HTMLButtonElement && !button.disabled) return button;
    }
    return undefined;
  };

  const findNavigationScrollTarget = (
    direction: 'next' | 'previous',
  ): { readonly container: HTMLElement; readonly top: number } | undefined => {
    const container = document.querySelector('#shorts-container');
    const activeRenderer = findActiveRenderer();
    const slot = activeRenderer?.parentElement?.parentElement;
    const target = direction === 'next'
      ? slot?.nextElementSibling
      : slot?.previousElementSibling;
    if (!(container instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      return undefined;
    }
    return { container, top: target.offsetTop };
  };

  const stabilizeDocumentViewport = (
    scrollLeft: number,
    scrollTop: number,
  ): void => {
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) return;
    // The Shorts carousel owns its own movement. A native navigation click can
    // also nudge the outer document by a few pixels, leaving the player lower
    // after automatic advance. Restore only that outer document offset.
    const restore = (): void => {
      if (!isShortsPage()) return;
      scrollingElement.scrollLeft = scrollLeft;
      scrollingElement.scrollTop = scrollTop;
    };
    requestAnimationFrame(() => requestAnimationFrame(restore));
    window.setTimeout(restore, 120);
    window.setTimeout(restore, 360);
    window.setTimeout(restore, 720);
  };

  const state: ShortsState = {
    autoAdvance: options.autoAdvance,
    advancing: false,
    progressGeneration: 0,
    progressByVideo,
    labels,
    bannedPublisherIds: new Set(options.bannedPublishers.flatMap(({ id, label }) => [
      id,
      ...(label.startsWith('@') ? [`handle:${label.toLowerCase()}`] : []),
    ])),
    resolveActivePublisher,
    async checkBannedPublisher() {
      if (!isShortsPage() || state.advancing) return;
      const currentUrl = location.href;
      const publisher = await resolveActivePublisher();
      if (
        !publisher ||
        location.href !== currentUrl ||
        !state.bannedPublisherIds.has(publisher.id) &&
        !publisher.aliases?.some((alias) => state.bannedPublisherIds.has(alias))
      ) {
        return;
      }
      if (state.navigate('next')) {
        window.setTimeout(() => void state.checkBannedPublisher(), 1_250);
      }
    },
    navigate(direction) {
      if (!isShortsPage() || state.advancing) return false;
      const button = findNavigationButton(direction);

      const currentUrl = location.href;
      const scrollTarget = findNavigationScrollTarget(direction);
      const scrollingElement = document.scrollingElement;
      const scrollLeft = scrollingElement?.scrollLeft ?? 0;
      const scrollTop = scrollingElement?.scrollTop ?? 0;
      state.advancing = true;
      state.lastAdvancedUrl = direction === 'next' ? currentUrl : undefined;
      state.showActionStatus(
        direction === 'next' ? state.labels.next : state.labels.previous,
        direction === 'next' ? '↓' : '↑',
      );
      if (!button) {
        // Ad renderers can replace the Shorts navigation chrome. Return false
        // so the Provider sends Electron's trusted ArrowUp/ArrowDown input;
        // synthetic KeyboardEvents are untrusted and YouTube ignores them.
        state.advancing = false;
        state.lastAdvancedUrl = undefined;
        return false;
      }
      pageGlobal.__kawaikaraUnifiedPictureInPicture
        ?.releaseLayoutForNavigation?.();
      button.click();
      button.blur();
      // YouTube normally animates #shorts-container for roughly half a
      // second. In unified PiP that temporarily moves the fixed video with
      // its carousel ancestor. Snap to the native target slot immediately;
      // YouTube still performs its own URL/player update, without exposing an
      // intermediate up/down offset in the PiP surface.
      if (scrollTarget) scrollTarget.container.scrollTop = scrollTarget.top;
      stabilizeDocumentViewport(scrollLeft, scrollTop);
      window.setTimeout(
        () => pageGlobal.__kawaikaraUnifiedPictureInPicture
          ?.restoreLayoutAfterNavigation?.(),
        120,
      );
      window.setTimeout(
        () => pageGlobal.__kawaikaraUnifiedPictureInPicture
          ?.restoreLayoutAfterNavigation?.(),
        280,
      );
      window.setTimeout(() => {
        state.advancing = false;
        if (location.href === currentUrl) state.lastAdvancedUrl = undefined;
        void state.checkBannedPublisher();
      }, 1_100);
      return true;
    },
    setAutoAdvance(enabled, announce) {
      const changed = state.autoAdvance !== enabled;
      state.autoAdvance = enabled;
      if (announce && changed) state.showAutoAdvanceStatus();
    },
    showAutoAdvanceStatus() {
      state.showActionStatus(
        state.autoAdvance ? state.labels.enabled : state.labels.disabled,
      );
    },
    showActionStatus(message, icon) {
      let host = document.querySelector<HTMLElement>(
        '[data-kawaikara-shorts-status="youtube"]',
      );
      if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.kawaikaraShortsStatus = 'youtube';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent =
          ':host{all:initial;position:fixed;left:50%;top:14%;z-index:2147483647;' +
          'transform:translate(-50%,-8px);opacity:0;pointer-events:none;' +
          'transition:opacity 160ms ease,transform 160ms ease}' +
          ':host([data-visible="true"]){opacity:1;transform:translate(-50%,0)}' +
          '.status{font:600 14px/1.2 system-ui,-apple-system,sans-serif;color:#fff;' +
          'padding:10px 14px;border:1px solid rgba(255,255,255,.2);border-radius:999px;' +
          'background:rgba(12,12,14,.84);box-shadow:0 8px 28px rgba(0,0,0,.34);' +
          'backdrop-filter:blur(12px)}';
        const value = document.createElement('div');
        value.className = 'status';
        shadow.append(style, value);
      }
      const value = host.shadowRoot?.querySelector('.status');
      if (value) value.textContent = icon ? `${icon}  ${message}` : message;
      // Append outside body so unified PiP's body-content visibility policy
      // does not hide the status. Re-appending also places it above PiP chrome.
      document.documentElement.append(host);
      host.dataset.visible = 'true';
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        delete host.dataset.visible;
        statusTimer = undefined;
      }, 1_450);
    },
  };

  const advanceAfterCompletion = (video: unknown): void => {
    if (
      state.lastAdvancedUrl &&
      state.lastAdvancedUrl !== location.href
    ) {
      state.lastAdvancedUrl = undefined;
    }
    if (
      !state.autoAdvance ||
      !isShortsPage() ||
      state.advancing ||
      state.lastAdvancedUrl === location.href ||
      !isActiveShortsVideo(video)
    ) {
      return;
    }
    state.navigate('next');
  };

  document.addEventListener(
    'ended',
    (event) => {
      const video = event.target;
      if (video instanceof HTMLVideoElement) progressByVideo.delete(video);
      advanceAfterCompletion(video);
    },
    true,
  );
  document.addEventListener(
    'playing',
    (event) => {
      if (isActiveShortsVideo(event.target)) void state.checkBannedPublisher();
    },
    true,
  );
  document.addEventListener(
    'yt-navigate-finish',
    () => window.setTimeout(() => void state.checkBannedPublisher(), 120),
    true,
  );
  document.addEventListener(
    'timeupdate',
    (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (state.lastAdvancedUrl && state.lastAdvancedUrl !== location.href) {
        state.lastAdvancedUrl = undefined;
      }
      if (
        !state.autoAdvance ||
        !isShortsPage() ||
        !isActiveShortsVideo(video) ||
        video.paused ||
        video.ended ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        !Number.isFinite(video.currentTime)
      ) {
        progressByVideo.delete(video);
        return;
      }

      const now = performance.now();
      const progress: ProgressSnapshot = {
        currentTime: video.currentTime,
        duration: video.duration,
        generation: state.progressGeneration,
        observedAt: now,
        url: location.href,
      };
      const previous = progressByVideo.get(video);
      progressByVideo.set(video, progress);
      if (
        !previous ||
        previous.url !== progress.url ||
        previous.generation !== progress.generation
      ) {
        return;
      }

      // Shorts loop instead of reliably emitting ended. Advance only after a
      // real end-to-start wrap, never merely because playback is near the end.
      const endThreshold = Math.min(
        1,
        Math.max(0.35, Math.abs(video.playbackRate) * 0.5),
      );
      const wrappedAtEnd =
        previous.currentTime >= previous.duration - endThreshold &&
        progress.currentTime <= endThreshold &&
        previous.currentTime - progress.currentTime >= progress.duration * 0.5 &&
        now - previous.observedAt <= 2_000;
      if (wrappedAtEnd) advanceAfterCompletion(video);
    },
    true,
  );
  document.addEventListener(
    'kawaikara:picture-in-picture-transition',
    () => {
      state.progressGeneration += 1;
    },
    true,
  );

  pageGlobal.__kawaikaraYouTubeShorts = state;
  void state.checkBannedPublisher();
}

async function readYouTubeShortsPublisher(): Promise<
  {
    readonly id: string;
    readonly label: string;
    readonly handle?: string;
    readonly imageUrl?: string;
  } | undefined
> {
  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraYouTubeShorts?: {
      resolveActivePublisher(): Promise<
        {
          readonly id: string;
          readonly label: string;
          readonly handle?: string;
          readonly imageUrl?: string;
        } | undefined
      >;
    };
  };
  return pageGlobal.__kawaikaraYouTubeShorts?.resolveActivePublisher();
}

function runYouTubeShortsCommand(options: YouTubeShortsCommandOptions): boolean {
  interface ShortsCommandState {
    navigate(direction: 'next' | 'previous'): boolean;
    readonly labels: { banned: string };
    showActionStatus(message: string, icon?: string): void;
    showAutoAdvanceStatus(): void;
  }
  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraYouTubeShorts?: ShortsCommandState;
  };
  const state = pageGlobal.__kawaikaraYouTubeShorts;
  if (!state) return false;
  if (options.command === 'announce') {
    state.showAutoAdvanceStatus();
    return true;
  }
  if (options.command === 'ban') {
    state.showActionStatus(state.labels.banned, '⊘');
    return true;
  }
  return state.navigate(options.command);
}

export function createYouTubeShortsInjectionScript(
  options: YouTubeShortsInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installYouTubeShorts, options);
}

export function createYouTubeShortsCommandScript(
  command: YouTubeShortsCommand,
): string {
  return serializePageInjectionWithOptions(runYouTubeShortsCommand, { command });
}

export function createYouTubeShortsPublisherScript(): string {
  return serializePageInjectionWithOptions(readYouTubeShortsPublisher, {});
}
