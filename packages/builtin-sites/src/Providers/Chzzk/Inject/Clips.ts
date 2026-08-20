import { serializePageInjectionWithOptions } from '../../../Inject/Serialize';

export interface ChzzkClipsInjectionOptions {
  readonly autoAdvance: boolean;
  readonly announce: boolean;
  readonly labels: {
    readonly enabled: string;
    readonly disabled: string;
    readonly next: string;
    readonly previous: string;
  };
}

export type ChzzkClipsCommand = 'next' | 'previous' | 'announce';

interface ChzzkClipsCommandOptions {
  readonly command: ChzzkClipsCommand;
}

/** CHZZK page-world implementation for short clip navigation. */
function installChzzkClips(options: ChzzkClipsInjectionOptions): void {
  interface ProgressSnapshot {
    readonly currentTime: number;
    readonly duration: number;
    readonly observedAt: number;
    readonly url: string;
  }

  interface ClipsState {
    autoAdvance: boolean;
    advancing: boolean;
    readonly labels: {
      enabled: string;
      disabled: string;
      next: string;
      previous: string;
    };
    readonly knownUrls: string[];
    readonly navigationHistory: string[];
    readonly progressByVideo: WeakMap<HTMLVideoElement, ProgressSnapshot>;
    navigate(direction: 'next' | 'previous'): boolean;
    refresh(): void;
    setAutoAdvance(enabled: boolean, announce: boolean): void;
    showActionStatus(message: string, icon?: string): void;
    showAutoAdvanceStatus(): void;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraChzzkClips?: ClipsState;
    __kawaikaraUnifiedPictureInPicture?: {
      releaseLayoutForNavigation?(): void;
      restoreLayoutAfterNavigation?(): void;
    };
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
  const labels = { ...options.labels };
  let lastObservedUrl = '';
  let statusTimer: number | undefined;

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

  const currentClipUrl = (): string | undefined => normalizeClipUrl(location.href);

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

  const isClipsPlaybackContext = (): boolean =>
    currentClipUrl() !== undefined || isEmbeddedChzzkShorts();

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

  const isActiveClipVideo = (candidate: unknown): candidate is HTMLVideoElement =>
    candidate instanceof HTMLVideoElement &&
    candidate.isConnected &&
    candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    visibleRatio(candidate) >= 0.5;

  const findActiveClipVideo = (): HTMLVideoElement | undefined =>
    [...document.querySelectorAll('video')].find(isActiveClipVideo);

  const findNativeNavigationButton = (
    direction: 'next' | 'previous',
  ): HTMLButtonElement | undefined => {
    const words = direction === 'next'
      ? /(?:다음|next)/i
      : /(?:이전|prev(?:ious)?)/i;
    for (const button of document.querySelectorAll('button')) {
      const description = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        button.dataset.testid,
        button.textContent,
      ].filter(Boolean).join(' ');
      if (words.test(description) && !button.disabled) return button;
    }
    return undefined;
  };

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

  const state: ClipsState = {
    autoAdvance: options.autoAdvance,
    advancing: false,
    labels,
    knownUrls,
    navigationHistory,
    progressByVideo,
    navigate(direction) {
      if (!isClipsPlaybackContext() || state.advancing) return false;
      const previousVideo = findActiveClipVideo();
      // executeJavaScriptInAllFrames installs this state in both the CHZZK
      // shell and its m.naver.com player iframe. Only the frame that actually
      // owns the visible video may operate the native Flicking carousel.
      if (!previousVideo) return false;
      const nativeButton = findNativeNavigationButton(direction);
      state.advancing = true;
      if (nativeButton) {
        // CHZZK renders the actual clip carousel in an m.naver.com iframe.
        // Its accessible previous/next buttons are intentionally zero-sized,
        // but their click handlers are the canonical Flicking navigation API.
        pageGlobal.__kawaikaraUnifiedPictureInPicture
          ?.releaseLayoutForNavigation?.();
        state.showActionStatus(
          direction === 'next' ? state.labels.next : state.labels.previous,
          direction === 'next' ? '↓' : '↑',
        );
        nativeButton.click();
        nativeButton.blur();
        const stopDetachedPlayback = (): void => {
          const activeVideo = findActiveClipVideo();
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

      window.setTimeout(() => {
        state.advancing = false;
        state.refresh();
      }, 1_100);
      return true;
    },
    refresh() {
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
        '[data-kawaikara-shorts-status="chzzk"]',
      );
      if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.kawaikaraShortsStatus = 'chzzk';
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
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => state.refresh());
  state.refresh();
  pageGlobal.__kawaikaraChzzkClips = state;
}

function runChzzkClipsCommand(options: ChzzkClipsCommandOptions): boolean {
  interface ClipsCommandState {
    navigate(direction: 'next' | 'previous'): boolean;
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

export function createChzzkClipsInjectionScript(
  options: ChzzkClipsInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installChzzkClips, options);
}

export function createChzzkClipsCommandScript(
  command: ChzzkClipsCommand,
): string {
  return serializePageInjectionWithOptions(runChzzkClipsCommand, { command });
}
