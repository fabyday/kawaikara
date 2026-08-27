import type { NewWindowPolicy } from './SiteContext';

/** Defines the shared web authentication hosts constant. */
const WEB_AUTHENTICATION_HOSTS = [
  'appleid.apple.com',
  'accounts.google.com',
  'accounts.kakao.com',
  'kauth.kakao.com',
  'nid.naver.com',
  'facebook.com',
  'login.live.com',
] as const;

/** Performs the web popup policy operation. */
export function webPopupPolicy(url: string): NewWindowPolicy {
  // Legacy Google gapi.auth2 (still used by Watcha in August 2026) creates a
  // named window with window.open('', ...) and navigates it only after the
  // handle is returned. Electron reports that first request as an empty URL,
  // not about:blank. Denying it makes Google report "Prompt dismissed"
  // without ever rendering an authentication window.
  if (url === '' || /^about:blank(?:[?#]|$)/i.test(url)) return 'popup';
  return /^https?:\/\//i.test(url) ? 'popup' : 'deny';
}

/**
 * Keep web OAuth in a child window that shares the Provider Session. Sending
 * these URLs to the main viewer breaks opener/callback flows, while opening the
 * system browser loses the Electron Session that must receive the result.
 */
export function webAuthenticationPolicy(
  url: string,
  fallback: NewWindowPolicy = 'viewer',
): NewWindowPolicy {
  if (url === '' || /^about:blank(?:[?#]|$)/i.test(url)) return 'popup';
  return matchesSiteUrlHost(url, WEB_AUTHENTICATION_HOSTS)
    ? 'popup'
    : fallback;
}

/** Performs the matches site URL host operation. */
export function matchesSiteUrlHost(
  value: string,
  hosts: readonly string[],
): boolean {
  const hostname = /^https?:\/\/([^/?#:]+)/i.exec(value)?.[1]?.toLowerCase();
  if (!hostname) return false;
  return hosts.some((host) => {
    const normalized = host.toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

/** Determines whether the site login navigation condition applies. */
export function isSiteLoginNavigation(
  value: string,
  hosts: readonly string[],
  paths: readonly string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const matchesHost = hosts.some((host) => {
    const normalized = host.toLowerCase().replace(/^www\./, '');
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
  return matchesHost && paths.some(
    (path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`),
  );
}

/** Sets the request header. */
export function setRequestHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existingName = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  headers[existingName ?? name] = value;
}

/** Creates the chromium user agent. */
export function createChromiumUserAgent(userAgent: string): string {
  return userAgent.replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '').trim();
}

/** Creates the chromium client hints. */
export function createChromiumClientHints(userAgent: string): string | undefined {
  const major = /(?:Chrome|Chromium)\/(\d+)/.exec(userAgent)?.[1];
  return major
    ? `"Google Chrome";v="${major}", "Chromium";v="${major}", "Not_A Brand";v="24"`
    : undefined;
}

/** Resolves the locale variant. */
export function resolveLocaleVariant<T>(
  locale: string | undefined,
  variants: {
    /** The default value. */
    readonly default: T;
    /** The ko value. */
    readonly ko?: T;
    /** The ja value. */
    readonly ja?: T;
  },
): T {
  const language = locale?.split(/[-_]/, 1)[0]?.toLowerCase();
  if (language === 'ko' && variants.ko !== undefined) return variants.ko;
  if (language === 'ja' && variants.ja !== undefined) return variants.ja;
  return variants.default;
}

/** Serialize a self-contained page-world entry point. */
export function serializePageInjection(entryPoint: () => unknown): string {
  return `(${entryPoint.toString()})();`;
}

/** Serialize a self-contained page-world entry point and JSON-safe options. */
export function serializePageInjectionWithOptions<T>(
  entryPoint: (options: T) => unknown,
  options: T,
): string {
  return `(${entryPoint.toString()})(${JSON.stringify(options)});`;
}

/** Describes the site login control injection options contract. */
export interface SiteLoginControlInjectionOptions {
  /** The marker value. */
  readonly marker: string;
  /** The selector value. */
  readonly selector: string;
  /** The action URL value. */
  readonly actionUrl: string;
  /** The fallback labels value. */
  readonly fallbackLabels?: readonly string[];
}

/**
 * Builds the standard external-login control bridge used by remote pages.
 * createExternalLoginFlow() in site-api/ExternalLoginFlow.ts is the only
 * runtime caller: it registers the result with the active Provider's
 * SitePagePipeline. Built-in Netflix and CoupangPlay Providers construct that
 * flow, but do not execute installLoginControl() directly.
 */
export function createLoginControlInjection(
  options: SiteLoginControlInjectionOptions,
): string {
  return serializePageInjectionWithOptions(installLoginControl, {
    ...options,
    /** The fallback labels value. */
    fallbackLabels: (options.fallbackLabels ?? []).map((label) =>
      label.toLowerCase()),
  });
}

/** Installs the login control. */
function installLoginControl(options: SiteLoginControlInjectionOptions): object {
  /** Performs the release gate operation. */
  const releaseGate = (): void => {
    document.documentElement?.setAttribute(
      'data-kawaikara-external-login-ready',
      'true',
    );
    document.getElementById('kawaikara-external-login-gate')?.remove();
  };
  const page = window as unknown as Record<string, unknown>;
  const existing = page[options.marker] as
    | { refresh?: () => void
    }
    | undefined;
  if (typeof existing?.refresh === 'function') {
    existing.refresh();
    releaseGate();
    return {
      /** The installed value. */
      installed: true,
      /** The reused value. */
      reused: true,
    };
  }
  const labels = options.fallbackLabels ?? [];
  /** Performs the control label operation. */
  const controlLabel = (control: Element): string => [
    control.getAttribute('aria-label'),
    control.getAttribute('title'),
    control.textContent,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  /** Performs the matches label operation. */
  const matchesLabel = (control: Element): boolean =>
    labels.some((label) => controlLabel(control).includes(label));
  /** Performs the mark operation. */
  const mark = (control: Element): void => {
    if (!(control instanceof HTMLElement)) return;
    control.dataset.kawaikaraLoginReady = 'true';
    control.style.setProperty('border-color', 'rgb(168 85 247)', 'important');
    control.style.setProperty(
      'box-shadow',
      '0 0 0 2px rgb(168 85 247 / 42%), 0 0 18px rgb(168 85 247 / 24%)',
      'important',
    );
  };
  /** Performs the refresh operation. */
  const refresh = (root: ParentNode | Element = document): void => {
    if (root instanceof Element && root.matches(options.selector)) mark(root);
    root.querySelectorAll(options.selector).forEach(mark);
    root.querySelectorAll('a,button,[role="button"]').forEach((control) => {
      if (matchesLabel(control)) mark(control);
    });
  };
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const direct = event.target.closest(options.selector);
    const semantic = event.target.closest('a,button,[role="button"]');
    if (!direct && (!semantic || !matchesLabel(semantic))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(options.actionUrl);
  }, true);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        refresh(mutation.target);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) refresh(node);
      });
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-label', 'data-cy', 'data-testid', 'data-uia', 'href'],
    childList: true,
    subtree: true,
  });
  page[options.marker] = { observer, refresh
  };
  refresh();
  releaseGate();
  return {
    /** The installed value. */
    installed: true,
    /** The reused value. */
    reused: false,
  };
}
