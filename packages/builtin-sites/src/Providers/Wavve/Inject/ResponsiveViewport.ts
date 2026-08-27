import { serializePageInjection } from '@kawaikara/site-api';

/**
 * Wavve currently ships `width=1480` in its viewport metadata. In a compact
 * desktop viewer that forces the header outside the visible page and can put
 * the login control beyond the right edge. Use the actual Kawaikara viewport
 * while leaving Wavve's own responsive CSS in charge of the layout.
 * WavveProvider.beforeLoad() in Providers/Wavve/Provider.ts is the sole caller;
 * it registers the serialized export with SitePagePipeline for each document.
 */
function installWavveResponsiveViewport(): {
  /** Whether the changed option is enabled. */
  readonly changed: boolean;
  /** The content value. */
  readonly content?: string;
} {
  if (!/(?:^|\.)wavve\.com$/i.test(location.hostname)) {
    return {
      /** The changed value. */
      changed: false,
    };
  }
  const viewport = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport" i]',
  );
  if (!viewport) return {
    /** The changed value. */
    changed: false,
  };
  const content = 'width=device-width, initial-scale=1';
  let changed = viewport.content !== content;
  if (changed) viewport.content = content;

  const styleId = 'kawaikara-wavve-compact-layout';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media (max-width: 1439px) {
        html,
        body,
        .body,
        .header,
        .footer,
        .background-color,
        .common-page,
        .list-view {
          min-width: 0 !important;
        }
        .header-nav > .wrap,
        .header-gnb {
          width: calc(100% - 40px) !important;
          max-width: 1240px !important;
        }
      }
    `;
    (document.head ?? document.documentElement).append(style);
    changed = true;
  }
  return {
    /** The changed value. */
    changed,
    /** The content value. */
    content,
  };
}

/** Defines the shared wavve responsive viewport script constant. */
export const WAVVE_RESPONSIVE_VIEWPORT_SCRIPT = serializePageInjection(
  installWavveResponsiveViewport,
);
