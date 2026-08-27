import { serializePageInjectionWithOptions } from '@kawaikara/site-api';

/**
 * CHZZK Clips page-world implementation. ChzzkProvider.load() registers
 * createChzzkClipsInjectionScript() in every frame, while
 * ChzzkProvider.runClipsCommand() uses createChzzkClipsCommandScript(). The
 * Provider file is the sole caller of both serialized factories.
 */

export interface ChzzkClipsInjectionOptions {
  /** Whether the auto advance option is enabled. */
  readonly autoAdvance: boolean;
  /** Whether the announce option is enabled. */
  readonly announce: boolean;
  /** The skip advertisement action URL value. */
  readonly skipAdvertisementActionUrl: string;
  /** The labels value. */
  readonly labels: {
    /** Whether the enabled option is enabled. */
    readonly enabled: string;
    /** The disabled value. */
    readonly disabled: string;
    /** The next value. */
    readonly next: string;
    /** The previous value. */
    readonly previous: string;
  };
}

/** Defines the CHZZK clips command type. */
export type ChzzkClipsCommand = 'next' | 'previous' | 'announce';

/** Describes the CHZZK clips command options contract. */
interface ChzzkClipsCommandOptions {
  /** The command value. */
  readonly command: ChzzkClipsCommand;
}

/** CHZZK page-world implementation for short clip navigation. */
function installChzzkClips(options: ChzzkClipsInjectionOptions): void {
  /** Describes the progress snapshot contract. */
  interface ProgressSnapshot {
    /** The current time value. */
    readonly currentTime: number;
    /** The duration value. */
    readonly duration: number;
    /** The observed at value. */
    readonly observedAt: number;
    /** The URL value. */
    readonly url: string;
  }

  /** Describes the clips state contract. */
  interface ClipsState {
    /** Whether the auto advance option is enabled. */
    autoAdvance: boolean;
    /** Whether the advancing option is enabled. */
    advancing: boolean;
    /** The pending direction value. */
    pendingDirection: 'next' | 'previous' | null;
    /** The pending direction active until value. */
    pendingDirectionActiveUntil: number;
    /** The labels value. */
    readonly labels: {
      /** Whether the enabled option is enabled. */
      enabled: string;
      /** The disabled value. */
      disabled: string;
      /** The next value. */
      next: string;
      /** The previous value. */
      previous: string;
    };
    /** The known URLs value. */
    readonly knownUrls: string[];
    /** The navigation history value. */
    readonly navigationHistory: string[];
    /** The progress by video value. */
    readonly progressByVideo: WeakMap<HTMLVideoElement, ProgressSnapshot>;
    /** Performs the navigate operation. */
    navigate(direction: 'next' | 'previous'): boolean;
    /** Performs the refresh operation. */
    refresh(): void;
    /** Sets the auto advance. */
    setAutoAdvance(enabled: boolean, announce: boolean): void;
    /** Performs the show action status operation. */
    showActionStatus(message: string, icon?: string): void;
    /** Performs the show auto advance status operation. */
    showAutoAdvanceStatus(): void;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkClips?: ClipsState;
  };
  const installed = pageGlobal.__kawaikaraChzzkClips;
  if (installed) {
    installed.labels.enabled = options.labels.enabled;
    installed.labels.disabled = options.labels.disabled;
    installed.labels.next = options.labels.next;
    installed.labels.previous = options.labels.previous;
    installed.setAutoAdvance(options.autoAdvance, options.announce);
    installed.refresh();
    return;
  }

  const knownUrls: string[] = [];
  const navigationHistory: string[] = [];
  const progressByVideo = new WeakMap<HTMLVideoElement, ProgressSnapshot>();
  const labels = { ...options.labels
  };
  let lastObservedUrl = '';
  let statusTimer: number | undefined;

  /** Normalizes the clip URL. */
  const normalizeClipUrl = (value: string): string | undefined => {
    try {
      const url = new URL(value, location.href);
      if (
        url.origin !== 'https://chzzk.naver.com' ||
        !/^\/clips\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
      ) {
        return undefined;
      }
      url.search = '';
      url.hash = '';
      return url.href;
    } catch {
      return undefined;
    }
  };

  /** Performs the current clip URL operation. */
  const currentClipUrl = (): string | undefined => normalizeClipUrl(location.href);

  /** Determines whether the embedded CHZZK shorts condition applies. */
  const isEmbeddedChzzkShorts = (): boolean => {
    if (location.hostname !== 'm.naver.com' || location.pathname !== '/shorts/') {
      return false;
    }
    const parameters = new URLSearchParams(location.search);
    return (
      parameters.get('embed') === 'true' &&
      parameters.get('serviceType')?.toUpperCase() === 'CHZZK'
    );
  };

  /** Determines whether the clips playback context condition applies. */
  const isClipsPlaybackContext = (): boolean =>
    currentClipUrl() !== undefined || isEmbeddedChzzkShorts();

  /** Ensures the embedded shorts layout guard. */
  const ensureEmbeddedShortsLayoutGuard = (): void => {
    if (!isEmbeddedChzzkShorts()) return;
    const styleId = 'kawaikara-chzzk-shorts-layout-guard';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body, #root {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: clip !important;
        overscroll-behavior-x: none !important;
      }
      [class*="FlickingView-module__flick_viewport"],
      [class*="FlickingView-module__flick_camera"] {
        width: 100% !important;
        max-width: 100% !important;
      }
      .webplayer-internal-video {
        object-position: center center !important;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  };

  /** Returns the current shorts viewer. */
  const getCurrentShortsViewer = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(
      '[class*="ContentViewer-module__viewer"]' +
        '[class*="ContentViewer-module__is_current"]',
    );

  /** Normalizes the embedded shorts position. */
  const normalizeEmbeddedShortsPosition = (): void => {
    if (!isEmbeddedChzzkShorts()) return;
    ensureEmbeddedShortsLayoutGuard();
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  };

  let positionNormalizationScheduled = false;
  /** Schedules the position normalization. */
  const schedulePositionNormalization = (): void => {
    if (!isEmbeddedChzzkShorts() || positionNormalizationScheduled) return;
    positionNormalizationScheduled = true;
    requestAnimationFrame(() => {
      positionNormalizationScheduled = false;
      normalizeEmbeddedShortsPosition();
    });
  };

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

  /** Determines whether the active clip video condition applies. */
  const isActiveClipVideo = (candidate: unknown): candidate is HTMLVideoElement =>
    candidate instanceof HTMLVideoElement &&
    candidate.isConnected &&
    candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    visibleRatio(candidate) >= 0.5;

  /** Finds the active clip video. */
  const findActiveClipVideo = (): HTMLVideoElement | undefined =>
    [...document.querySelectorAll('video')].find(isActiveClipVideo);

  /** Returns the current content token. */
  const getCurrentContentToken = (): string => {
    const viewer = getCurrentShortsViewer();
    const playerId = viewer?.querySelector<HTMLElement>('[id^="wpc-"]')?.id ?? '';
    const video = viewer?.querySelector<HTMLVideoElement>('video');
    const source = video?.currentSrc ?? video?.src ?? '';
    return playerId || source ? `${playerId}|${source}` : '';
  };

  /** Returns the current shorts advertisement. */
  const getCurrentShortsAdvertisement = (): Element | null => {
    if (!isEmbeddedChzzkShorts()) return null;
    const viewer = getCurrentShortsViewer();
    if (!viewer) return null;
    const selector =
      '[data-testid="AdPlayer"],' +
      '[data-testid="BumperAdPlayer"],' +
      '[data-testid="AdInfoChip"]';
    // NAVER currently places AdPlayer on the active viewer itself, while
    // sponsored organic cards place AdInfoChip inside it. Cover both shapes.
    return viewer.matches(selector) ? viewer : viewer.querySelector(selector);
  };

  /** Closes the detached live mini player. */
  const closeDetachedLiveMiniPlayer = (): void => {
    // The outer chzzk.naver.com document can keep a live stream running in its
    // own mini player while the actual Shorts video lives in m.naver.com.
    // Once the shell is on /clips, no video in this outer document is the
    // Shorts player, so stop it and close its native mini-player control.
    if (!currentClipUrl()) return;
    for (const video of document.querySelectorAll('video')) {
      if (!video.paused) video.pause();
    }
    // CHZZK's current inner PiP is #live_player_layout.pip_mode. Its actual
    // close control is a sibling button labelled only "닫기", so the former
    // generic "mini/PIP + close" text match could never find it.
    for (const layout of document.querySelectorAll<HTMLElement>(
      '#live_player_layout.pip_mode, .chzzk_player.pip_mode',
    )) {
      const controlsRoot = layout.parentElement ?? layout;
      const closeButton = [...controlsRoot.querySelectorAll<HTMLButtonElement>(
        'button',
      )].find((button) => {
        const label = [
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
          button.textContent,
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        return /^(?:닫기|close)$/i.test(label);
      });
      if (closeButton) {
        closeButton.click();
        return;
      }
    }
    for (const control of document.querySelectorAll<HTMLElement>(
      'button,[role="button"]',
    )) {
      const label = [
        control.getAttribute('aria-label'),
        control.getAttribute('title'),
        control.textContent,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (
        /(?:미니.{0,12}(?:닫기|종료)|(?:닫기|종료).{0,12}미니|close.{0,12}(?:mini|pip)|(?:mini|pip).{0,12}close)/i
          .test(label)
      ) {
        control.click();
        break;
      }
    }
  };

  /** Performs the resume active playback operation. */
  const resumeActivePlayback = (
    previousVideo: HTMLVideoElement | undefined,
    previousSource: string,
    previousTime: number,
  ): void => {
    let attempts = 0;
    /** Performs the retry operation. */
    const retry = (): void => {
      attempts += 1;
      const candidates = [...document.querySelectorAll('video')]
        .filter((video): video is HTMLVideoElement =>
          video instanceof HTMLVideoElement &&
          video.isConnected &&
          visibleRatio(video) >= 0.35,
        )
        .sort((left, right) => visibleRatio(right) - visibleRatio(left));
      const activeVideo = candidates.find((video) =>
        !previousVideo ||
        video !== previousVideo ||
        video.currentSrc !== previousSource ||
        video.currentTime + 1 < previousTime,
      ) ?? candidates[0];
      const navigationCommitted = Boolean(activeVideo && (
        !previousVideo ||
        activeVideo !== previousVideo ||
        activeVideo.currentSrc !== previousSource ||
        activeVideo.currentTime + 1 < previousTime
      ));
      if (activeVideo && navigationCommitted) {
        for (const video of document.querySelectorAll('video')) {
          if (video !== activeVideo && !video.paused) video.pause();
        }
        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          activeVideo.paused
        ) {
          void activeVideo.play().catch(() => undefined);
        }
        if (!activeVideo.paused && activeVideo.readyState >= 2) return;
      }
      if (attempts < 30) {
        window.setTimeout(retry, 120);
      } else if (activeVideo?.paused) {
        // Last-resort recovery for CHZZK builds that reuse the same media URL
        // and reset the timeline before our first post-navigation sample.
        void activeVideo.play().catch(() => undefined);
      }
    };
    window.setTimeout(retry, 40);
  };

  /** Finds the native navigation button. */
  const findNativeNavigationButton = (
    direction: 'next' | 'previous',
  ): HTMLButtonElement | undefined => {
    const words = direction === 'next'
      ? /(?:다음|next)/i
      : /(?:이전|prev(?:ious)?)/i;
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
    // Prefer CHZZK's Flicking carousel controls. The player also exposes a
    // generic "Play next video" end-screen button; using that one navigates
    // out of the Shorts carousel and can tear down application PiP.
    const carouselButton = buttons.find((button) => {
      const description = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        button.dataset.testid,
        button.textContent,
      ].filter(Boolean).join(' ');
      return !button.disabled && words.test(description) && Boolean(
        String(button.className).includes('FlickingPcNavigationControlsView') ||
        /^(?:다음|이전)\s*클립$/i.test(button.textContent?.trim() ?? ''),
      );
    });
    if (carouselButton) return carouselButton;
    return buttons.find((button) => {
      if (button.disabled || button.closest('.pzp, [class*="webplayer"]')) {
        return false;
      }
      const description = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        button.dataset.testid,
        button.textContent,
      ].filter(Boolean).join(' ');
      return words.test(description);
    });
  };

  /** Performs the activate URL operation. */
  const activateUrl = (targetUrl: string): boolean => {
    const matchingLink = [...document.querySelectorAll('a[href]')].find(
      (link) =>
        link instanceof HTMLAnchorElement &&
        normalizeClipUrl(link.href) === targetUrl,
    );
    if (matchingLink instanceof HTMLAnchorElement) {
      matchingLink.click();
    } else {
      location.assign(targetUrl);
    }
    return true;
  };

  // One pending intent is retained for the duration of CHZZK's carousel
  // transition. It is deliberately not a counter: rapid/held input can move
  // again as soon as the next card is ready, but cannot build a navigation
  // stack that keeps running after the user stops.
  const INPUT_INTENT_LEASE_MS = 650;
  /** Performs the finish navigation when ready operation. */
  const finishNavigationWhenReady = (
    previousVideo: HTMLVideoElement | undefined,
    previousSource: string,
    previousTime: number,
    previousContentToken: string,
  ): void => {
    let attempts = 0;
    /** Performs the finish operation. */
    const finish = (): void => {
      attempts += 1;
      const activeVideo = findActiveClipVideo();
      const currentContentToken = getCurrentContentToken();
      const contentChanged = Boolean(
        activeVideo &&
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          (activeVideo !== previousVideo ||
            activeVideo.currentSrc !== previousSource ||
            activeVideo.currentTime + 1 < previousTime ||
            (currentContentToken !== '' &&
              currentContentToken !== previousContentToken)),
      );
      if (!contentChanged && attempts < 50) {
        window.setTimeout(finish, 24);
        return;
      }

      state.advancing = false;
      state.refresh();
      schedulePositionNormalization();
      const pendingDirection = state.pendingDirection;
      const pendingStillActive =
        pendingDirection !== null &&
        performance.now() <= state.pendingDirectionActiveUntil;
      state.pendingDirection = null;
      state.pendingDirectionActiveUntil = 0;
      if (pendingStillActive && pendingDirection !== null) {
        state.navigate(pendingDirection);
      }
    };
    window.setTimeout(finish, 24);
  };

  const state: ClipsState = {
    autoAdvance: options.autoAdvance,
    advancing: false,
    pendingDirection: null,
    pendingDirectionActiveUntil: 0,
    labels,
    knownUrls,
    navigationHistory,
    progressByVideo,
    /** Performs the navigate operation. */
    navigate(direction) {
      if (!isClipsPlaybackContext()) return false;
      if (state.advancing) {
        // Keep only the latest, short-lived intent. Repeated input while the
        // next clip is loading is honored as soon as it becomes ready, but no
        // count is queued and nothing continues after the user stops pressing.
        state.pendingDirection = direction;
        state.pendingDirectionActiveUntil =
          performance.now() + INPUT_INTENT_LEASE_MS;
        return true;
      }
      state.pendingDirection = null;
      state.pendingDirectionActiveUntil = 0;
      const nativeButton = findNativeNavigationButton(direction);
      const previousVideo = findActiveClipVideo();
      // executeJavaScriptInAllFrames installs this state in both the CHZZK
      // shell and its m.naver.com player iframe. Only the frame that actually
      // owns the Flicking carousel may operate it. Advertisement cards can
      // temporarily have no active video, but their next/previous controls
      // must remain usable.
      if (!previousVideo && !nativeButton) return false;
      const previousSource = previousVideo?.currentSrc ?? '';
      const previousTime = previousVideo?.currentTime ?? 0;
      const previousContentToken = getCurrentContentToken();
      state.advancing = true;
      if (nativeButton) {
        // CHZZK renders the actual clip carousel in an m.naver.com iframe.
        // Its accessible previous/next buttons are intentionally zero-sized,
        // but their click handlers are the canonical Flicking navigation API.
        state.showActionStatus(
          direction === 'next' ? state.labels.next : state.labels.previous,
          direction === 'next' ? '↓' : '↑',
        );
        nativeButton.click();
        nativeButton.blur();
        schedulePositionNormalization();
        resumeActivePlayback(previousVideo, previousSource, previousTime);
        /** Stops the detached playback. */
        const stopDetachedPlayback = (): void => {
          const activeVideo = findActiveClipVideo();
          // During Flicking's transition there can briefly be no video with a
          // 50% visible area. Pausing every video in that gap pauses the new
          // Short just before it becomes active and was the cause of the
          // intermittent "next Short is stopped" regression.
          if (!activeVideo) return;
          for (const video of document.querySelectorAll('video')) {
            if (video === activeVideo) continue;
            if (!video.paused) video.pause();
          }
        };
        window.setTimeout(stopDetachedPlayback, 180);
        window.setTimeout(stopDetachedPlayback, 520);
        window.setTimeout(stopDetachedPlayback, 980);
      } else {
        const current = currentClipUrl();
        if (!current) {
          state.advancing = false;
          return false;
        }
        if (direction === 'previous' && navigationHistory.length > 1) {
          navigationHistory.pop();
          const previousUrl = navigationHistory.at(-1);
          if (!previousUrl) {
            state.advancing = false;
            return false;
          }
          activateUrl(previousUrl);
        } else {
          const currentIndex = knownUrls.indexOf(current);
          const targetUrl = direction === 'next'
            ? knownUrls[currentIndex >= 0 ? currentIndex + 1 : 0] ??
              knownUrls.find((candidate) => candidate !== current)
            : knownUrls[currentIndex - 1];
          if (!targetUrl || targetUrl === current) {
            state.advancing = false;
            return false;
          }
          if (direction === 'next') navigationHistory.push(targetUrl);
          activateUrl(targetUrl);
        }
      }
      finishNavigationWhenReady(
        previousVideo,
        previousSource,
        previousTime,
        previousContentToken,
      );
      return true;
    },
    /** Performs the refresh operation. */
    refresh() {
      schedulePositionNormalization();
      closeDetachedLiveMiniPlayer();
      for (const link of document.querySelectorAll('a[href*="/clips/"]')) {
        const url = link instanceof HTMLAnchorElement
          ? normalizeClipUrl(link.href)
          : undefined;
        if (url && !knownUrls.includes(url)) knownUrls.push(url);
      }
      const current = currentClipUrl();
      if (current && current !== lastObservedUrl) {
        lastObservedUrl = current;
        if (navigationHistory.at(-1) !== current) navigationHistory.push(current);
      }
      scheduleAdvertisementSkip();
    },
    /** Sets the auto advance. */
    setAutoAdvance(enabled, announce) {
      const changed = state.autoAdvance !== enabled;
      state.autoAdvance = enabled;
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
        '[data-kawaikara-shorts-status="chzzk"]',
      );
      if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.kawaikaraShortsStatus = 'chzzk';
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
      document.documentElement.append(host);
      host.dataset.visible = 'true';
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        delete host.dataset.visible;
        statusTimer = undefined;
      }, 1_450);
    },
  };

  let advertisementSkipTimer: number | undefined;
  let advertisementSkipAttempts = 0;
  let pendingAdvertisement: Element | null = null;
  /** Schedules the advertisement skip. */
  const scheduleAdvertisementSkip = (delayMilliseconds = 80): void => {
    if (!isEmbeddedChzzkShorts()) return;
    const advertisement = getCurrentShortsAdvertisement();
    if (!advertisement) {
      advertisementSkipAttempts = 0;
      pendingAdvertisement = null;
      if (advertisementSkipTimer !== undefined) {
        window.clearTimeout(advertisementSkipTimer);
        advertisementSkipTimer = undefined;
      }
      return;
    }
    if (advertisement !== pendingAdvertisement) {
      advertisementSkipAttempts = 0;
      pendingAdvertisement = advertisement;
    }
    if (advertisementSkipTimer !== undefined) return;
    advertisementSkipTimer = window.setTimeout(() => {
      advertisementSkipTimer = undefined;
      const currentAdvertisement = getCurrentShortsAdvertisement();
      if (!currentAdvertisement) {
        advertisementSkipAttempts = 0;
        pendingAdvertisement = null;
        return;
      }
      if (state.advancing || currentAdvertisement !== advertisement) {
        // The ad badge can render before NAVER finishes swapping the player
        // card. Retry the current marker instead of waiting for another DOM
        // mutation that may never arrive.
        scheduleAdvertisementSkip(120);
        return;
      }
      advertisementSkipAttempts += 1;
      const navigationStarted = state.navigate('next');
      if (!navigationStarted && advertisementSkipAttempts >= 8) {
        // Narrow PiP windows use NAVER's mobile carousel, which intentionally
        // omits the desktop next button. Give the carousel time to finish
        // mounting first, then route a trusted input through the Provider.
        location.assign(options.skipAdvertisementActionUrl);
      }
      // Do not permanently mark an advertisement as handled. NAVER renders
      // the marker before its navigation button, and the first click can be
      // ignored while the card is mounting. Poll until the marker disappears.
      scheduleAdvertisementSkip(navigationStarted ? 300 : 120);
    }, delayMilliseconds);
  };

  /** Performs the advance after completion operation. */
  const advanceAfterCompletion = (video: unknown): void => {
    if (
      !state.autoAdvance ||
      !isClipsPlaybackContext() ||
      state.advancing ||
      !isActiveClipVideo(video)
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
    'timeupdate',
    (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (
        !state.autoAdvance ||
        !isClipsPlaybackContext() ||
        !isActiveClipVideo(video) ||
        video.paused ||
        video.ended ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        progressByVideo.delete(video);
        return;
      }
      const progress: ProgressSnapshot = {
        currentTime: video.currentTime,
        duration: video.duration,
        observedAt: performance.now(),
        url: location.href,
      };
      const previous = progressByVideo.get(video);
      progressByVideo.set(video, progress);
      if (!previous || previous.url !== progress.url) return;
      const threshold = Math.min(
        1,
        Math.max(0.35, Math.abs(video.playbackRate) * 0.5),
      );
      // Move before CHZZK mounts its generic player end-screen. Waiting for
      // ended lets the player-level next/close action race the Shorts
      // carousel and can dismantle the application PiP window.
      if (
        video.currentTime > 0.5 &&
        video.duration - video.currentTime <= Math.min(0.3, threshold)
      ) {
        advanceAfterCompletion(video);
        return;
      }
      if (
        previous.currentTime >= previous.duration - threshold &&
        progress.currentTime <= threshold &&
        previous.currentTime - progress.currentTime >= progress.duration * 0.5 &&
        progress.observedAt - previous.observedAt <= 2_000
      ) {
        advanceAfterCompletion(video);
      }
    },
    true,
  );

  const observer = new MutationObserver(() => state.refresh());
  observer.observe(document.documentElement, { childList: true, subtree: true
  });
  window.addEventListener('popstate', () => state.refresh());
  window.addEventListener('resize', schedulePositionNormalization);
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('a[href*="/clips/"]')
      : null;
    if (!link || !normalizeClipUrl(link.href)) return;
    // Stop the old live before CHZZK has a chance to convert it into an inner
    // PiP during the route transition.
    for (const video of document.querySelectorAll('video')) {
      if (!video.paused) video.pause();
    }
  }, true);
  state.refresh();
  pageGlobal.__kawaikaraChzzkClips = state;
}

/** Runs the CHZZK clips command. */
function runChzzkClipsCommand(options: ChzzkClipsCommandOptions): boolean {
  /** Describes the clips command state contract. */
  interface ClipsCommandState {
    /** Performs the navigate operation. */
    navigate(direction: 'next' | 'previous'): boolean;
    /** Performs the show auto advance status operation. */
    showAutoAdvanceStatus(): void;
  }
  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkClips?: ClipsCommandState;
  };
  const state = pageGlobal.__kawaikaraChzzkClips;
  if (!state) return false;
  if (options.command === 'announce') {
    state.showAutoAdvanceStatus();
    return true;
  }
  return state.navigate(options.command);
}

/** Creates the CHZZK clips injection script. */
export function createChzzkClipsInjectionScript(
  options: ChzzkClipsInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installChzzkClips, options);
}

/** Creates the CHZZK clips command script. */
export function createChzzkClipsCommandScript(
  command: ChzzkClipsCommand,
): string {
  return serializePageInjectionWithOptions(runChzzkClipsCommand, {
    /** The command value. */
    command,
  });
}
