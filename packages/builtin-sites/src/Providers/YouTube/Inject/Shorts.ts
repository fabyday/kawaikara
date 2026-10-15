import { serializePageInjectionWithOptions } from '@kawaikara/site-api';

/**
 * YouTube Shorts page-world implementation used only by YouTubeProvider in
 * Providers/YouTube/Provider.ts. beforeLoad() registers installation,
 * runShortsCommand() executes navigation/status commands, and
 * getShortFormVideoPublisher() executes the publisher reader. The three
 * exported factories below are the only serialization boundary.
 */

export interface YouTubeShortsInjectionOptions {
  /** Whether the auto advance option is enabled. */
  readonly autoAdvance: boolean;
  /** The banned publishers value. */
  readonly bannedPublishers: readonly {
    /** The ID value. */
    readonly id: string;
    /** The label value. */
    readonly label: string;
  }[];
  /** Whether the announce option is enabled. */
  readonly announce: boolean;
  /** The labels value. */
  readonly labels: {
    /** Whether the enabled option is enabled. */
    readonly enabled: string;
    /** The disabled value. */
    readonly disabled: string;
    /** The banned value. */
    readonly banned: string;
    /** The next value. */
    readonly next: string;
    /** The previous value. */
    readonly previous: string;
  };
}

/** Defines the you tube shorts command type. */
export type YouTubeShortsCommand = 'next' | 'previous' | 'announce' | 'ban';

/** Describes the you tube shorts command options contract. */
interface YouTubeShortsCommandOptions {
  /** The command value. */
  readonly command: YouTubeShortsCommand;
}

/**
 * This entire function executes in YouTube's page world. Keep it self-contained
 * so TypeScript can check DOM access before it is serialized.
 */
function installYouTubeShorts(options: YouTubeShortsInjectionOptions): void {
  /** Describes the shorts publisher contract. */
  interface ShortsPublisher {
    /** The ID value. */
    readonly id: string;
    /** The label value. */
    readonly label: string;
    /** The handle value. */
    readonly handle?: string;
    /** The image URL value. */
    readonly imageUrl?: string;
    /** The aliases value. */
    readonly aliases?: readonly string[];
  }

  /** Describes the progress snapshot contract. */
  interface ProgressSnapshot {
    /** The current time value. */
    readonly currentTime: number;
    /** The duration value. */
    readonly duration: number;
    /** The generation value. */
    readonly generation: number;
    /** The observed at value. */
    readonly observedAt: number;
    /** The URL value. */
    readonly url: string;
  }

  /** Describes the shorts state contract. */
  interface ShortsState {
    /** Removes all page listeners and pending Plugin work. */
    dispose(): void;
    /** Whether the auto advance option is enabled. */
    autoAdvance: boolean;
    /** Whether the advancing option is enabled. */
    advancing: boolean;
    /** The last advanced URL value. */
    lastAdvancedUrl?: string;
    /** The progress generation value. */
    progressGeneration: number;
    /** The progress by video value. */
    readonly progressByVideo: WeakMap<HTMLVideoElement, ProgressSnapshot>;
    /** The labels value. */
    readonly labels: {
      /** Whether the enabled option is enabled. */
      enabled: string;
      /** The disabled value. */
      disabled: string;
      /** The banned value. */
      banned: string;
      /** The next value. */
      next: string;
      /** The previous value. */
      previous: string;
    };
    /** The banned publisher IDs value. */
    readonly bannedPublisherIds: Set<string>;
    /** Resolves the active publisher. */
    resolveActivePublisher(): Promise<ShortsPublisher | undefined>;
    /** Performs the check banned publisher operation. */
    checkBannedPublisher(): Promise<void>;
    /** Performs the navigate operation. */
    navigate(direction: 'next' | 'previous'): boolean;
    /** Sets the auto advance. */
    setAutoAdvance(enabled: boolean, announce: boolean): void;
    /** Performs the show action status operation. */
    showActionStatus(message: string, icon?: string): void;
    /** Performs the show auto advance status operation. */
    showAutoAdvanceStatus(): void;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraYouTubeShorts?: ShortsState;
    __kawaikaraUnifiedPictureInPicture?: {
      /** Video currently presented by the shared PiP session. */
      readonly video?: HTMLVideoElement;
      /** Performs the release layout for navigation operation. */
      releaseLayoutForNavigation?(): void;
      /** Restores the layout after navigation. */
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

  const lifetime = new AbortController();
  const timers = new Set<number>();
  /** Schedules work owned by this Plugin activation. */
  const later = (callback: () => void, delay: number): number => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!lifetime.signal.aborted) callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  /** Registers a listener removed on Plugin deactivation. */
  const listen = (target: EventTarget, name: string, listener: (event: Event) => void,
    options: boolean | AddEventListenerOptions = false): void => {
    target.addEventListener(name, listener, {
      ...(typeof options === 'boolean' ? { capture: options } : options),
      signal: lifetime.signal,
    });
  };

  const progressByVideo = new WeakMap<HTMLVideoElement, ProgressSnapshot>();
  const labels = { ...options.labels
  };
  let statusTimer: number | undefined;
  const publisherByHandle = new Map<string, ShortsPublisher>();

  /** Determines whether the shorts page condition applies. */
  const isShortsPage = (): boolean =>
    /^\/shorts\/[^/?#]+\/?$/.test(location.pathname);

  /** Performs the visible ratio operation. */
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

  /** Determines whether the active shorts video condition applies. */
  const isActiveShortsVideo = (candidate: unknown): candidate is HTMLVideoElement =>
    candidate instanceof HTMLVideoElement &&
    candidate.isConnected &&
    candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    visibleRatio(candidate) >= 0.5;

  /** Finds the active renderer. */
  const findActiveRenderer = (): Element | undefined =>
    document.querySelector('ytd-reel-video-renderer[is-active]') ??
    [...document.querySelectorAll('ytd-reel-video-renderer')].find(
      (renderer) => visibleRatio(renderer) >= 0.5,
    );

  // Keep carousel identity across native window reparenting. Pixel offsets are
  // invalid after a resize, so resolve the same slot's offset on each frame.
  /** Identity and temporary layout state spanning one native view transfer. */
  interface TransitionAnchor {
    /** Original media element, which may survive a carousel resize. */
    readonly video: HTMLVideoElement;
    /** Carousel renderer owning the original video. */
    readonly renderer: Element;
    /** Site-provided identity used to detect recycled renderers. */
    readonly videoId: string | null;
    /** Media source at transition start. */
    readonly source: string;
    /** Stable URL for loop comparisons during transient router updates. */
    readonly url: string;
    /** Restores only scroll styles applied by this transition. */
    readonly restoreScroll: () => void;
    /** Actual completion deferred until the layout settles. */
    completed: boolean;
    /** Time the host acknowledged final native bounds. */
    finishedAt?: number;
    /** Start time used to bound interrupted transitions. */
    readonly startedAt: number;
  }
  let transition: TransitionAnchor | undefined;
  let navigationGeneration = 0;
  let transitionFrame = 0;
  let lastResizeAt = 0;
  /** Reads the renderer identity without using its transient active flag. */
  const rendererVideoId = (renderer: Element): string | null =>
    renderer.getAttribute('video-id') ??
    renderer.querySelector<HTMLAnchorElement>('a[href^="/shorts/"]')
      ?.pathname.split('/')[2] ?? null;
  /** Rejects removed/recycled video elements and changed media sources. */
  const anchorIsCurrent = (anchor: TransitionAnchor): boolean =>
    isShortsPage() && anchor.video.isConnected && anchor.renderer.isConnected &&
    anchor.renderer.contains(anchor.video) &&
    rendererVideoId(anchor.renderer) === anchor.videoId &&
    anchor.video.currentSrc === anchor.source;
  /** Releases temporary layout and queued completion without navigating. */
  const cancelTransition = (): void => {
    transition?.restoreScroll();
    transition = undefined;
    cancelAnimationFrame(transitionFrame);
  };
  /** Makes delayed work from an older navigation inert. */
  const invalidateNavigation = (): void => {
    navigationGeneration += 1;
    state.advancing = false;
  };
  // A deliberate navigation takes precedence over the transition anchor.
  /** Lets explicit user navigation supersede automatic position preservation. */
  const userNavigation = (event: Event): void => {
    if (!event.isTrusted) return;
    if (event instanceof KeyboardEvent &&
      !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    if (event.type === 'click' && !(event.target instanceof Element &&
      event.target.closest('#navigation-button-up, #navigation-button-down, a[href^="/shorts/"]'))) return;
    cancelTransition();
    invalidateNavigation();
  };
  for (const name of ['wheel', 'touchstart', 'keydown', 'click']) {
    listen(document,name, userNavigation, { capture: true, passive: true });
  }
  /** Aligns the original slot using the current viewport geometry. */
  const alignTransitionAnchor = (anchor: TransitionAnchor): void => {
    const container = document.querySelector('#shorts-container');
    const slot = anchor.renderer.parentElement?.parentElement;
    if (container instanceof HTMLElement && slot instanceof HTMLElement && container.contains(slot)) {
      container.scrollTop = slot.offsetTop;
    }
  };
  listen(window, 'resize', () => {
    lastResizeAt = performance.now();
    if (transition && anchorIsCurrent(transition)) alignTransitionAnchor(transition);
  });

  /** Resolves the image URL. */
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
        return { url, distance: horizontalDistance + verticalDistance
        };
      })
      .filter((candidate): candidate is { url: string; distance: number
      } =>
        candidate !== undefined,
      )
      .sort((left, right) => left.distance - right.distance)[0]?.url;
  };

  /** Resolves the active publisher. */
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
      const enriched = { ...cached, imageUrl: currentImageUrl
      };
      publisherByHandle.set(key, enriched);
      return enriched;
    }

    let id = handleId;
    let displayLabel = label || handle;
    let imageUrl = currentImageUrl;
    try {
      const response = await fetch(`/${handle}`, { credentials: 'include'
      });
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

  /** Finds the navigation button. */
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

  /** Finds the navigation scroll target. */
  const findNavigationScrollTarget = (
    direction: 'next' | 'previous',
  ): { readonly container: HTMLElement; readonly top: number
  } | undefined => {
    const container = document.querySelector('#shorts-container');
    const activeRenderer = findActiveRenderer();
    const slot = activeRenderer?.parentElement?.parentElement;
    const target = direction === 'next'
      ? slot?.nextElementSibling
      : slot?.previousElementSibling;
    if (!(container instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      return undefined;
    }
    return { container, top: target.offsetTop
    };
  };

  /** Performs the align active shorts renderer operation. */
  const alignActiveShortsRenderer = (): void => {
    const container = document.querySelector('#shorts-container');
    const activeRenderer = findActiveRenderer();
    const slot = activeRenderer?.parentElement?.parentElement;
    if (!(container instanceof HTMLElement) || !(slot instanceof HTMLElement)) {
      return;
    }
    // YouTube can finish its URL transition before the vertical carousel has
    // reached the corresponding slot. Leaving that intermediate scroll offset
    // in unified PiP makes only part of the replacement video visible.
    container.scrollTop = slot.offsetTop;
  };

  /** Performs the stabilize document viewport operation. */
  const stabilizeDocumentViewport = (
    scrollLeft: number,
    scrollTop: number,
    generation: number,
  ): void => {
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) return;
    // The Shorts carousel owns its own movement. A native navigation click can
    // also nudge the outer document by a few pixels, leaving the player lower
    // after automatic advance. Restore only that outer document offset.
    /** Restores the operation. */
    const restore = (): void => {
      if (!isShortsPage() || generation !== navigationGeneration) return;
      scrollingElement.scrollLeft = scrollLeft;
      scrollingElement.scrollTop = scrollTop;
    };
    requestAnimationFrame(() => requestAnimationFrame(restore));
    later(restore, 120);
    later(restore, 360);
    later(restore, 720);
  };

  const state: ShortsState = {
    dispose() {
      lifetime.abort();
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      cancelTransition();
      invalidateNavigation();
      document.querySelector('[data-kawaikara-shorts-status="youtube"]')?.remove();
      if (pageGlobal.__kawaikaraYouTubeShorts === state) delete pageGlobal.__kawaikaraYouTubeShorts;
    },
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
    /** Performs the check banned publisher operation. */
    async checkBannedPublisher() {
      if (lifetime.signal.aborted || !isShortsPage() || state.advancing) return;
      const currentUrl = location.href;
      const publisher = await resolveActivePublisher();
      if (
        lifetime.signal.aborted ||
        !publisher ||
        location.href !== currentUrl ||
        !state.bannedPublisherIds.has(publisher.id) &&
        !publisher.aliases?.some((alias) => state.bannedPublisherIds.has(alias))
      ) {
        return;
      }
      if (state.navigate('next')) {
        later(() => void state.checkBannedPublisher(), 1_250);
      }
    },
    /** Performs the navigate operation. */
    navigate(direction) {
      if (lifetime.signal.aborted || !isShortsPage()) return false;
      if (state.advancing) {
        // A repeated key press during the current transition is intentionally
        // coalesced into that transition instead of being queued for a later
        // Short. This makes "press until it moves" stop on the next item.
        return true;
      }
      cancelTransition();
      const generation = ++navigationGeneration;
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
      stabilizeDocumentViewport(scrollLeft, scrollTop, generation);
      later(
        () => {
          if (generation !== navigationGeneration || !isShortsPage()) return;
          alignActiveShortsRenderer();
          pageGlobal.__kawaikaraUnifiedPictureInPicture
            ?.restoreLayoutAfterNavigation?.();
        },
        360,
      );
      later(
        () => {
          if (generation !== navigationGeneration || !isShortsPage()) return;
          alignActiveShortsRenderer();
          pageGlobal.__kawaikaraUnifiedPictureInPicture
            ?.restoreLayoutAfterNavigation?.();
        },
        640,
      );
      later(() => {
        if (generation !== navigationGeneration) return;
        state.advancing = false;
        if (location.href === currentUrl) state.lastAdvancedUrl = undefined;
        void state.checkBannedPublisher();
      }, 620);
      return true;
    },
    /** Sets the auto advance. */
    setAutoAdvance(enabled, announce) {
      const changed = state.autoAdvance !== enabled;
      state.autoAdvance = enabled;
      if (changed) state.progressGeneration += 1;
      if (!enabled && transition) transition.completed = false;
      if (announce && changed) state.showAutoAdvanceStatus();
    },
    /** Performs the show auto advance status operation. */
    showAutoAdvanceStatus() {
      state.showActionStatus(
        state.autoAdvance ? state.labels.enabled : state.labels.disabled,
      );
    },
    /** Performs the show action status operation. */
    showActionStatus(message, icon) {
      let host = document.querySelector<HTMLElement>(
        '[data-kawaikara-shorts-status="youtube"]',
      );
      if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.kawaikaraShortsStatus = 'youtube';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        const shadow = host.attachShadow({ mode: 'open'
        });
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
      statusTimer = later(() => {
        delete host.dataset.visible;
        statusTimer = undefined;
      }, 1_450);
    },
  };

  /** Performs the advance after completion operation. */
  const advanceAfterCompletion = (video: unknown): void => {
    if (transition && video === transition.video && anchorIsCurrent(transition)) {
      if (state.autoAdvance) transition.completed = true;
      return;
    }
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

  listen(document,
    'ended',
    (event) => {
      const video = event.target;
      if (video instanceof HTMLVideoElement) progressByVideo.delete(video);
      advanceAfterCompletion(video);
    },
    true,
  );
  listen(document,
    'playing',
    (event) => {
      if (isActiveShortsVideo(event.target)) void state.checkBannedPublisher();
    },
    true,
  );
  listen(document,
    'yt-navigate-finish',
    () => later(() => void state.checkBannedPublisher(), 120),
    true,
  );
  listen(document,
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
        !(isActiveShortsVideo(video) ||
          (transition?.video === video && anchorIsCurrent(transition))) ||
        video.paused ||
        video.ended ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        !Number.isFinite(video.currentTime)
      ) {
        if (transition?.video !== video) progressByVideo.delete(video);
        return;
      }

      const now = performance.now();
      const progress: ProgressSnapshot = {
        currentTime: video.currentTime,
        duration: video.duration,
        generation: state.progressGeneration,
        observedAt: now,
        url: transition?.video === video ? transition.url : location.href,
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
  listen(document,
    'kawaikara:picture-in-picture-transition',
    (event) => {
      if (event instanceof CustomEvent && event.detail?.phase === 'end') {
        if (transition) transition.finishedAt = performance.now();
        return;
      }
      cancelTransition();
      invalidateNavigation();
      if (!isShortsPage()) return;
      const pipVideo = pageGlobal.__kawaikaraUnifiedPictureInPicture?.video;
      const currentId = location.pathname.split('/')[2];
      const renderer = [...document.querySelectorAll('ytd-reel-video-renderer')]
        .find(candidate => rendererVideoId(candidate) === currentId) ??
        pipVideo?.closest('ytd-reel-video-renderer') ?? findActiveRenderer();
      const video = renderer?.querySelector('video') ??
        (pipVideo && renderer?.contains(pipVideo) ? pipVideo : undefined);
      if (!renderer || !(video instanceof HTMLVideoElement)) return;
      const container = document.querySelector<HTMLElement>('#shorts-container');
      const scrollStyles = ['scroll-behavior', 'scroll-snap-type'].map(property => ({
        property, value: container?.style.getPropertyValue(property) ?? '',
        priority: container?.style.getPropertyPriority(property) ?? '',
        override: property === 'scroll-behavior' ? 'auto' : 'none',
      }));
      // Prevent the browser from snapping to a neighbouring item using the old
      // viewport's offset while the native window dimensions are changing.
      scrollStyles.forEach(({ property, override }) => container?.style.setProperty(property, override, 'important'));
      const anchor: TransitionAnchor = {
        renderer, video, videoId: rendererVideoId(renderer), source: video.currentSrc,
        url: location.href, completed: video.ended, startedAt: performance.now(),
        restoreScroll: () => scrollStyles.forEach(({ property, value, priority, override }) => {
          if (container?.style.getPropertyValue(property) !== override ||
            container.style.getPropertyPriority(property) !== 'important') return;
          if (value) container.style.setProperty(property, value, priority);
          else container.style.removeProperty(property);
        }),
      };
      transition = anchor;
      /** Holds the anchor until native transfer and resize events settle. */
      const settle = (): void => {
        if (transition !== anchor) return;
        if (!anchorIsCurrent(anchor)) { cancelTransition(); return; }
        alignTransitionAnchor(anchor);
        const now = performance.now();
        // The manager sends end only after native bounds have been restored.
        // Keep a bounded fallback for interrupted/older transition callers.
        if ((anchor.finishedAt !== undefined && now - Math.max(anchor.finishedAt, lastResizeAt) >= 120) ||
          now - anchor.startedAt >= 2000) {
          cancelTransition();
          if (state.autoAdvance && (anchor.completed || anchor.video.ended) &&
            state.lastAdvancedUrl !== location.href) {
            state.navigate('next');
          }
          return;
        }
        transitionFrame = requestAnimationFrame(settle);
      };
      transitionFrame = requestAnimationFrame(settle);
    },
    true,
  );

  pageGlobal.__kawaikaraYouTubeShorts = state;
  void state.checkBannedPublisher();
}

/** Reads the you tube shorts publisher. */
async function readYouTubeShortsPublisher(): Promise<
  {
    /** The ID value. */
    readonly id: string;
    /** The label value. */
    readonly label: string;
    /** The handle value. */
    readonly handle?: string;
    /** The image URL value. */
    readonly imageUrl?: string;
  } | undefined
> {
  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraYouTubeShorts?: {
      /** Resolves the active publisher. */
      resolveActivePublisher(): Promise<
        {
          /** The ID value. */
          readonly id: string;
          /** The label value. */
          readonly label: string;
          /** The handle value. */
          readonly handle?: string;
          /** The image URL value. */
          readonly imageUrl?: string;
        } | undefined
      >;
    };
  };
  return pageGlobal.__kawaikaraYouTubeShorts?.resolveActivePublisher();
}

/** Runs the you tube shorts command. */
function runYouTubeShortsCommand(options: YouTubeShortsCommandOptions): boolean {
  /** Describes the shorts command state contract. */
  interface ShortsCommandState {
    /** Performs the check banned publisher operation. */
    checkBannedPublisher(): Promise<void>;
    /** Performs the navigate operation. */
    navigate(direction: 'next' | 'previous'): boolean;
    /** The labels value. */
    readonly labels: {
      /** The banned value. */
      banned: string;
    };
    /** Performs the show action status operation. */
    showActionStatus(message: string, icon?: string): void;
    /** Performs the show auto advance status operation. */
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
    void state.checkBannedPublisher();
    return true;
  }
  return state.navigate(options.command);
}

/** Creates the you tube shorts injection script. */
export function createYouTubeShortsInjectionScript(
  options: YouTubeShortsInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installYouTubeShorts, options);
}

/** Creates the you tube shorts command script. */
export function createYouTubeShortsCommandScript(
  command: YouTubeShortsCommand,
): string {
  return serializePageInjectionWithOptions(runYouTubeShortsCommand, {
    /** The command value. */
    command,
  });
}

/** Creates the you tube shorts publisher script. */
export function createYouTubeShortsPublisherScript(): string {
  return serializePageInjectionWithOptions(readYouTubeShortsPublisher, {});
}

/** Removes only the Shorts Plugin runtime from the current document. */
export function createYouTubeShortsCleanupScript(): string {
  return serializePageInjectionWithOptions(() => {
    (globalThis as typeof globalThis & {
      __kawaikaraYouTubeShorts?: {
        /** Releases the current page activation. */
        dispose(): void;
      };
    }).__kawaikaraYouTubeShorts?.dispose();
  }, undefined);
}
