import { serializePageInjection } from './Serialize';

/**
 * Installs app-owned theme compatibility inside a remote page.
 *
 * Electron propagates `nativeTheme.themeSource` to every renderer through the
 * real `prefers-color-scheme` media query. Standards-based sites need no DOM
 * changes. YouTube reads the media query while bootstrapping, then caches the
 * result in the `dark` attribute on `<html>`, so this bridge keeps that cached
 * presentation state synchronized with Electron's media-query change event.
 * Keeping the bridge in Main means Providers do not own application theming.
 */
function installRemoteThemeBridge(): void {
  interface RemoteThemeState {
    apply(): void;
    observer: MutationObserver;
    query: MediaQueryList;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraRemoteTheme?: RemoteThemeState;
  };
  const installed = pageGlobal.__kawaikaraRemoteTheme;
  if (installed) {
    installed.apply();
    return;
  }

  const isYouTube = /(^|\.)youtube\.com$/i.test(location.hostname);
  if (!isYouTube) return;

  let applying = false;
  const query = matchMedia('(prefers-color-scheme: dark)');
  const state: RemoteThemeState = {
    apply() {
      const root = document.documentElement;
      if (!root || applying) return;
      applying = true;
      try {
        // YouTube's own theme selectors use html[dark]. This is deliberately
        // presentation-only: account settings, cookies, and Provider state are
        // left untouched.
        root.toggleAttribute('dark', query.matches);
      } finally {
        applying = false;
      }
    },
    observer: new MutationObserver(() => undefined),
    query,
  };

  let queued = false;
  state.observer = new MutationObserver(() => {
    if (applying || queued) return;
    if (document.documentElement.hasAttribute('dark') === query.matches) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      state.apply();
    });
  });
  state.observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dark'],
  });
  query.addEventListener('change', state.apply);
  document.addEventListener('yt-navigate-finish', state.apply, true);
  window.addEventListener('pageshow', state.apply);

  pageGlobal.__kawaikaraRemoteTheme = state;
  state.apply();
}

export const createRemoteThemeBridgeInjectionScript = (): string =>
  serializePageInjection(installRemoteThemeBridge);
