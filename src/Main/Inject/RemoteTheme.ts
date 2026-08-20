import { serializePageInjectionWithOptions } from './Serialize';

export type RemotePageTheme = 'dark' | 'light';

interface RemoteThemeInjectionOptions {
  readonly theme: RemotePageTheme;
}

/**
 * Applies app-owned theme compatibility inside a remote page.
 *
 * Chromium's emulated `prefers-color-scheme` is enough for standards-based
 * sites. YouTube reads that preference only while bootstrapping, however, and
 * subsequently renders from the `dark` attribute on `<html>`. Keeping this
 * bridge in Main means Providers do not need to reimplement application theme
 * behavior.
 */
function applyRemotePageTheme(options: RemoteThemeInjectionOptions): void {
  interface RemoteThemeState {
    theme: RemotePageTheme;
    apply(): void;
    observer: MutationObserver;
  }

  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraRemoteTheme?: RemoteThemeState;
  };
  const installed = pageGlobal.__kawaikaraRemoteTheme;
  if (installed) {
    installed.theme = options.theme;
    installed.apply();
    return;
  }

  const isYouTube = /(^|\.)youtube\.com$/i.test(location.hostname);
  let applying = false;
  const state: RemoteThemeState = {
    theme: options.theme,
    apply() {
      const root = document.documentElement;
      if (!root || applying) return;
      applying = true;
      try {
        root.style.colorScheme = state.theme;
        if (isYouTube) {
          // YouTube does not reevaluate prefers-color-scheme after startup.
          // Its own theme selectors use html[dark], so update that same public
          // DOM state immediately without reloading or involving the Provider.
          root.toggleAttribute('dark', state.theme === 'dark');
        }
      } finally {
        applying = false;
      }
    },
    observer: new MutationObserver(() => undefined),
  };

  if (isYouTube) {
    let queued = false;
    state.observer = new MutationObserver(() => {
      if (applying || queued) return;
      const shouldBeDark = state.theme === 'dark';
      if (document.documentElement.hasAttribute('dark') === shouldBeDark) return;
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
    document.addEventListener('yt-navigate-finish', state.apply, true);
  }

  pageGlobal.__kawaikaraRemoteTheme = state;
  state.apply();
}

export const createRemoteThemeInjectionScript = (
  theme: RemotePageTheme,
): string => serializePageInjectionWithOptions(applyRemotePageTheme, { theme });
