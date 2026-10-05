import type { VideoMessages } from '../Common/IPC';

/** App-owned drop feedback, isolated from each Provider's page styles. */
export function createVideoDropOverlay() {
  let host: HTMLElement | undefined;
  let title: HTMLElement | undefined;
  let hint: HTMLElement | undefined;
  let labels: VideoMessages | undefined;
  let state: 'hidden' | 'dragging' | 'opening' | 'failed' | 'ambiguous' = 'hidden';

  /** Mounts once without a native child view, focus changes, or video reloads. */
  const mount = () => {
    if (host || !document.documentElement) return;
    host = document.createElement('kawaikara-video-drop');
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { opacity: 0; transition: opacity 140ms ease; }
      :host([data-visible]) { opacity: 1; }
      .surface { position:absolute; inset:16px; display:grid; place-content:center;
        justify-items:center; gap:12px; box-sizing:border-box; padding:24px;
        border:2px dashed #c4b5fd; border-radius:20px; background:rgb(18 16 28 / 86%);
        color:#fafafa; font:500 18px/1.5 system-ui,sans-serif; text-align:center;
        box-shadow:0 0 0 16px rgb(0 0 0 / 28%); overflow:hidden; }
      .glyph { font-size:42px; line-height:1; color:#ddd6fe; }
      .hint { font-size:14px; color:#d4d4d8; }
      :host([data-failed]) .surface { border-color:#fda4af; }
      @media(prefers-reduced-motion:reduce) { :host { transition:none; } }
    `;
    const surface = document.createElement('section');
    surface.className = 'surface';
    surface.setAttribute('role', 'status');
    surface.setAttribute('aria-live', 'polite');
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = '↓';
    glyph.setAttribute('aria-hidden', 'true');
    title = document.createElement('span');
    hint = document.createElement('span');
    hint.className = 'hint';
    surface.append(glyph, title, hint);
    shadow.append(style, surface);
    (document.fullscreenElement ?? document.documentElement).append(host);
  };

  /** Renders text only; never interpolates file names or messages as HTML. */
  const render = () => {
    if (state !== 'hidden') mount();
    if (!host || !title || !hint) return;
    host.toggleAttribute('data-visible', state !== 'hidden');
    host.toggleAttribute('data-failed', state === 'failed');
    host.setAttribute('aria-hidden', String(state === 'hidden'));
    title.textContent = labels
      ? state === 'ambiguous' ? labels.dropSelectionRequired
        : state === 'failed' ? labels.dropVideoFailed
        : state === 'opening' ? labels.dropVideoOpening : labels.dropVideo
      : '';
    hint.textContent = labels && state === 'dragging' ? labels.dropVideoHint : '';
  };

  return {
    /** Receives translated strings resolved exclusively by Main. */
    setMessages(messages: VideoMessages) { labels = messages; render(); },
    /** Changes only visual state, not playback or app focus. */
    show(next: typeof state) { state = next; render(); },
  };
}
