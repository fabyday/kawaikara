import type { AppTheme } from '../../Common/IPC';
import type { SiteTransitionState } from '../../Common/SiteTransition';
import type { AppMessages } from '../Functional/RendererMessages';
import { serializePageInjectionWithOptions } from './Serialize';

/** Failure copy needed by the lightweight app-owned viewer backing page. */
export type SiteTransitionMessages = Pick<AppMessages,
  'siteTransitionFailed' | 'siteTransitionRecovery'>;

/** Options serialized only into the app-owned document, never a Provider page. */
interface SiteTransitionSurfaceOptions {
  /** The current transition, absent when the backing page is idle. */
  readonly state: SiteTransitionState | undefined;
  /** Locale-backed failure and recovery copy. */
  readonly messages: SiteTransitionMessages;
  /** Resolved application language. */
  readonly locale: string;
  /** Selected application theme. */
  readonly theme: AppTheme;
}

/** Creates an idle backing page that shows feedback only after activation fails. */
export function createSiteTransitionSurfaceHtml(theme: AppTheme): string {
  return `<!doctype html><html data-theme="${theme}" data-active="false"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <style>
      :root{color-scheme:dark;--background:#09090b;--foreground:#e4e4e7;--muted:#a1a1aa;--accent:#c084fc}
      :root[data-theme="light"]{color-scheme:light;--background:#f4f4f5;--foreground:#27272a;--muted:#71717a;--accent:#9333ea}
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--background)}
      body{display:grid;place-items:center;color:var(--foreground);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      section{max-width:520px;padding:28px;text-align:center;overflow-wrap:anywhere}
      :root[data-active="false"] section{display:none}
      h1{margin:0;font-size:22px;font-weight:600;line-height:1.4}
      p{margin:12px 0 0;color:var(--muted);font-size:13px;line-height:1.7}
      #site{color:var(--accent);font-size:12px;font-weight:600;letter-spacing:.03em}
      #recovery[hidden]{display:none}
    </style></head><body><section id="transition" role="alert" aria-hidden="true">
      <p id="site"></p>
      <h1 id="title"></h1><p id="description"></p><p id="recovery" hidden></p>
    </section></body></html>`;
}

/** Applies inert locale/title/error text without replacing or reloading the document. */
function updateSiteTransitionSurface(options: SiteTransitionSurfaceOptions): void {
  const root = document.documentElement;
  const state = options.state;
  const active = state?.phase === 'failed';
  root.lang = options.locale;
  root.dataset.theme = options.theme;
  root.dataset.active = String(active);
  root.dataset.phase = state?.phase ?? 'ready';
  const transition = document.getElementById('transition')!;
  transition.setAttribute('aria-hidden', String(!active));
  document.getElementById('site')!.textContent = active ? state.title : '';
  document.getElementById('title')!.textContent = active ? options.messages.siteTransitionFailed : '';
  document.getElementById('description')!.textContent = active ? state.error ?? '' : '';
  const recovery = document.getElementById('recovery')!;
  recovery.hidden = !active;
  recovery.textContent = active ? options.messages.siteTransitionRecovery : '';
}

/** Creates the backing-page update command with a small locale-backed payload. */
export function createUpdateSiteTransitionSurfaceScript(
  state: SiteTransitionState | undefined,
  messages: SiteTransitionMessages,
  locale: string,
  theme: AppTheme,
): string {
  return serializePageInjectionWithOptions(updateSiteTransitionSurface, {
    /** Current Provider lifecycle. */
    state,
    /** Application transition copy only. */
    messages,
    /** Resolved application language. */
    locale,
    /** Application theme. */
    theme,
  });
}
