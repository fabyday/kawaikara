import type { PictureInPictureDomSubtitleOptions } from '@kawaikara/site-api';
import { serializePageInjectionWithOptions } from './Serialize';

/** Serializable operations for one frame-scoped DOM adapter. */
interface SubtitleOperation extends PictureInPictureDomSubtitleOptions {
  /** Opaque adapter identity, never an IPC channel. */
  readonly id: string;
  /** Absolute size multiplier; absent means dispose. */
  readonly scale?: number;
}

/** Serialize the reversible subtitle adapter without closing over Main values. */
export function createPictureInPictureSubtitleScript(options: SubtitleOperation): string {
  return serializePageInjectionWithOptions(updatePictureInPictureSubtitles, options);
}

/** Own caption typography/layout properties, leaving unrelated site styles untouched. */
function updatePictureInPictureSubtitles(options: SubtitleOperation): void {
  /** Original and last-written values for a single inline property. */
  interface SavedProperty {
    /** Original inline value. */
    value: string;
    /** Original important flag. */
    priority: string;
    /** Last adapter write, used to distinguish site-originated changes. */
    applied: string;
    /** Last requested layout value, before CSSOM canonicalizes zero axes/colors. */
    requested?: string;
  }
  /** Minimal reversible style snapshot. */
  interface SavedText {
    /** Original font size. */
    font: SavedProperty;
    /** Original line height. */
    line: SavedProperty;
    /** Whether the site originally had a style attribute. */
    hadStyle: boolean;
  }
  /** Reversible positioning and wrapping overrides for one caption box. */
  interface SavedLayout {
    /** Inline properties changed by the App, excluding fonts/colors/backgrounds. */
    properties: Map<string, SavedProperty>;
    /** Whether the site originally had a style attribute. */
    hadStyle: boolean;
  }
  /** Original WebVTT horizontal settings; vertical placement is deliberately preserved. */
  interface SavedCue {
    /** Site-owned text alignment. */
    align: VTTCue['align'];
    /** Site-owned horizontal anchor. */
    position: VTTCue['position'];
    /** Site-owned anchor interpretation. */
    positionAlign: VTTCue['positionAlign'] | undefined;
    /** Site-owned cue width percentage. */
    size: number;
    /** Vertical settings owned only when a Provider explicitly requests bottom placement. */
    bottomPlacement?: {
      /** Original line position. */
      line: VTTCue['line'];
      /** Original line interpretation. */
      snapToLines: boolean;
      /** Original line anchor. */
      lineAlign: VTTCue['lineAlign'];
      /** Last App-owned percentage anchor. */
      appliedLine: number;
    };
  }
  /** Page-local resources for one adapter. */
  interface SubtitleState {
    /** Apply the current multiplier to newly rendered captions. */
    update(scale: number): void;
    /** Release all page-local resources. */
    dispose(): void;
  }
  const pageWindow = window as Window & {
    /** Multiple convenience adapters may coexist in a custom Provider. */
    __kawaikaraPictureInPictureSubtitles?: Record<string, SubtitleState>;
    /** Select only the video already chosen by the App's PiP engine. */
    __kawaikaraUnifiedPictureInPicture?: {
      /** Currently selected PiP video. */
      video: HTMLVideoElement;
    };
  };
  const states: Record<string, SubtitleState> = pageWindow.__kawaikaraPictureInPictureSubtitles ??= Object.create(null);
  const existing = states[options.id];
  if (options.scale === undefined) {
    existing?.dispose();
    delete states[options.id];
    if (Object.keys(states).length === 0) {
      delete pageWindow.__kawaikaraPictureInPictureSubtitles;
    }
    return;
  }
  if (existing) {
    existing.update(options.scale);
    return;
  }

  let scale = options.scale;
  let disposed = false;
  let scheduled: number | undefined;
  let rootsDirty = true;
  let observedRoots: Array<Document | ShadowRoot> = [];
  let observedCaptions = new Set<HTMLElement>();
  const saved = new Map<HTMLElement, SavedText>();
  const layouts = new Map<HTMLElement, SavedLayout>();
  const savedCues = new Map<VTTCue, SavedCue>();
  const tracks = new Set<TextTrack>();
  const styles = new Map<Document | ShadowRoot, HTMLStyleElement>();
  const markedVideos = new Map<HTMLVideoElement, string | null>();
  const marker = `data-kawaikara-subtitles-${options.id}`;
  let layoutVideo: HTMLVideoElement | undefined;
  const selectors = (options.overlaySelectors ?? []).filter((selector) => {
    try { document.querySelector(selector); return true; } catch { return false; }
  });
  const textSelectors = options.textSelectors?.filter((selector) => {
    try { document.querySelector(selector); return true; } catch { return false; }
  });
  const alignmentSelectors = options.alignmentSelectors?.filter((selector) => {
    try { document.querySelector(selector); return true; } catch { return false; }
  });
  const horizontal = options.alignment?.horizontal ?? (options.layout === 'preserve' ? 'preserve' : 'center');
  const vertical = options.alignment?.vertical ?? 'preserve';
  const boxScaling = options.scaleMode === 'box';
  // Keep rolling-player geometry in CSS, not inline overrides which a player
  // can erase in its RAF and expose for one paint before our next RAF runs.
  const stableBoxLayout = boxScaling && vertical === 'bottom' && horizontal === 'center';
  const captionSelector = boxScaling && alignmentSelectors !== undefined
    ? alignmentSelectors.join(',')
    : [...selectors, ...(textSelectors ?? []), ...(alignmentSelectors ?? [])].join(',');

  /** Validate optional Provider placement values without allowing NaN/negative geometry. */
  const bounded = (value: number | undefined, fallback: number, maximum: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : fallback;
  /** A stable image-relative gap, independent of caption size and letterbox bars. */
  const bottomInset = (height: number) => Math.max(
    height * bounded(options.alignment?.bottomInsetRatio, 0.08, 0.4),
    Math.min(height * 0.25, bounded(options.alignment?.minimumBottomInsetPx, 12, 200)),
  );

  /** Snapshot a property before the adapter changes it. */
  const capture = (element: HTMLElement, name: string): SavedProperty => ({
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name),
    applied: '',
  });
  /** Preserve new inline values written by the site while PiP is active. */
  const restoreProperty = (element: HTMLElement, name: string, property: SavedProperty) => {
    if (element.style.getPropertyValue(name) !== property.applied ||
        element.style.getPropertyPriority(name) !== 'important') return;
    if (property.value) element.style.setProperty(name, property.value, property.priority);
    else element.style.removeProperty(name);
  };
  /** Remove our previous absolute overrides before measuring the player's base size. */
  const restoreText = () => {
    for (const [element, snapshot] of saved) {
      restoreProperty(element, 'font-size', snapshot.font);
      restoreProperty(element, 'line-height', snapshot.line);
      if (!snapshot.hadStyle && element.getAttribute('style') === '') {
        element.removeAttribute('style');
      }
    }
    saved.clear();
  };
  /** Restore App positioning after fonts, including originally absent style attributes. */
  const restoreLayout = () => {
    for (const [element, snapshot] of layouts) {
      for (const [name, property] of snapshot.properties) {
        restoreProperty(element, name, property);
      }
      if (!snapshot.hadStyle && element.getAttribute('style') === '') element.removeAttribute('style');
      layouts.delete(element);
    }
  };
  /** Restore only native-cue values still owned by the App. */
  const restoreCue = (cue: VTTCue, snapshot: SavedCue) => {
    if (cue.align === 'center') cue.align = snapshot.align;
    if (cue.position === 50) cue.position = snapshot.position;
    if (snapshot.positionAlign !== undefined && cue.positionAlign === 'center') cue.positionAlign = snapshot.positionAlign;
    if (cue.size === 92) cue.size = snapshot.size;
    if (snapshot.bottomPlacement) {
      const original = snapshot.bottomPlacement;
      if (cue.line === original.appliedLine) cue.line = original.line;
      if (!cue.snapToLines) cue.snapToLines = original.snapToLines;
      if (cue.lineAlign === 'end') cue.lineAlign = original.lineAlign;
    }
  };
  /** Release native cue settings on exit, not on every DOM mutation. */
  const restoreCues = () => {
    for (const [cue, snapshot] of savedCues) restoreCue(cue, snapshot);
    savedCues.clear();
  };
  /** Snapshot each property once even when caption selectors overlap. */
  const setLayout = (element: HTMLElement, properties: Record<string, string>) => {
    let snapshot = layouts.get(element);
    if (!snapshot) {
      snapshot = { properties: new Map(), hadStyle: saved.get(element)?.hadStyle ?? element.hasAttribute('style') };
      layouts.set(element, snapshot);
    }
    for (const [name, value] of Object.entries(properties)) {
      let property = snapshot.properties.get(name);
      if (!property) {
        property = capture(element, name);
        snapshot.properties.set(name, property);
      } else if (element.style.getPropertyValue(name) !== property.applied ||
          element.style.getPropertyPriority(name) !== 'important') {
        // A retained box may receive fresh inline positioning from its player.
        // Keep that latest source value for cleanup, rather than the entry value.
        property.value = element.style.getPropertyValue(name);
        property.priority = element.style.getPropertyPriority(name);
      }
      if (property.requested !== value || element.style.getPropertyValue(name) !== property.applied ||
          element.style.getPropertyPriority(name) !== 'important') {
        element.style.setProperty(name, value, 'important');
      }
      property.applied = element.style.getPropertyValue(name);
      property.requested = value;
    }
  };
  /** Find caption ancestors across open shadow boundaries without moving site DOM. */
  const composedParent = (element: HTMLElement): HTMLElement | null => {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
  };
  /** Bounds of the displayed image, excluding object-fit:contain letterboxing. */
  const videoBounds = (video: HTMLVideoElement | undefined) => {
    const rect = video?.getBoundingClientRect();
    const computed = video ? getComputedStyle(video) : undefined;
    let width = rect && rect.width > 0 ? rect.width : innerWidth;
    let height = rect && rect.height > 0 ? rect.height : innerHeight;
    let left = rect && rect.width > 0 ? rect.left : 0;
    let top = rect && rect.height > 0 ? rect.top : 0;
    const contained = Boolean(video && video.videoWidth > 0 && video.videoHeight > 0 && computed?.objectFit === 'contain');
    if (video && contained) {
      const ratio = Math.min(width / video.videoWidth, height / video.videoHeight);
      const imageWidth = video.videoWidth * ratio;
      const imageHeight = video.videoHeight * ratio;
      left += (width - imageWidth) / 2;
      top += (height - imageHeight) / 2;
      width = imageWidth;
      height = imageHeight;
    }
    const right = Math.min(innerWidth, left + width);
    const bottom = Math.min(innerHeight, top + height);
    left = Math.max(0, left);
    top = Math.max(0, top);
    return {
      left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top),
      viewportFitted: Boolean(rect && contained && computed?.objectPosition === '50% 50%' &&
        Math.abs(rect.left) < 0.5 && Math.abs(rect.top) < 0.5 &&
        Math.abs(rect.width - innerWidth) < 0.5 && Math.abs(rect.height - innerHeight) < 0.5),
    };
  };
  /** Adjust only the horizontal translation, retaining the site's Y/Z offsets and transform. */
  const centerHorizontally = (element: HTMLElement, center: number) => {
    const rect = element.getBoundingClientRect();
    const offset = center - rect.left - rect.width / 2;
    if (Math.abs(offset) < 0.01) return;
    // Computed values can contain calc() with spaces. Split only outside parentheses.
    const translation = getComputedStyle(element).translate;
    const axes = translation === 'none' ? ['0px'] : translation.match(/(?:[^\s()]+|\([^()]*\))+/g) ?? ['0px'];
    const [x, ...remaining] = axes;
    setLayout(element, { translate: `calc(${x} + ${String(offset)}px) ${remaining.join(' ')}`.trim() });
  };
  /** Center caption boxes/text horizontally without taking over any vertical anchors. */
  const centerLayout = (overlays: Set<HTMLElement>, video: HTMLVideoElement | undefined) => {
    if (horizontal === 'preserve') return;
    const bounds = videoBounds(video);
    const gutter = Math.min(bounds.width / 4, Math.max(12, bounds.width * 0.04));
    const center = bounds.left + bounds.width / 2;
    for (const overlay of overlays) {
      let parent = composedParent(overlay);
      while (parent && !overlays.has(parent)) parent = composedParent(parent);
      if (parent) continue;
      const elements = new Set<HTMLElement>([overlay]);
      for (const element of elements) {
        for (const child of Array.from(element.children)) {
          if (child instanceof HTMLElement) elements.add(child);
        }
        if (element.shadowRoot) {
          for (const child of Array.from(element.shadowRoot.children)) {
            if (child instanceof HTMLElement) elements.add(child);
          }
        }
      }
      for (const element of elements) {
        if (['STYLE', 'SCRIPT', 'BR'].includes(element.tagName)) continue;
        setLayout(element, {
          'box-sizing': 'border-box', 'text-align': 'center',
          'white-space': 'pre-line', 'overflow-wrap': 'anywhere',
          'min-width': '0', 'max-width': '100%',
          'width': getComputedStyle(element).display === 'inline' ? 'auto' : '100%',
          'overflow-x': 'visible', 'overflow-y': 'visible', 'clip-path': 'none', 'contain': 'none',
        });
        const computed = getComputedStyle(element);
        if (computed.display === 'flex' || computed.display === 'inline-flex') {
          setLayout(element, computed.flexDirection.startsWith('column')
            ? { 'align-items': 'center' }
            : { 'justify-content': 'center', 'flex-wrap': 'wrap' });
        } else if (computed.display === 'grid' || computed.display === 'inline-grid') {
          setLayout(element, { 'justify-items': 'center', 'justify-content': 'center' });
        }
      }
      setLayout(overlay, {
        ...(getComputedStyle(overlay).display === 'inline' ? { display: 'block' } : {}),
        'width': `${String(bounds.width - gutter * 2)}px`,
      });
      // Parents first: their horizontal translation also moves positioned children.
      // Preserve position/top/bottom/height and all vertical transforms, including
      // bottom-anchored captions that grow upward when the font size changes.
      centerHorizontally(overlay, center);
      for (const element of elements) {
        if (element !== overlay && getComputedStyle(element).position !== 'static') {
          centerHorizontally(element, center);
        }
      }
    }
  };
  /** Position only caption windows; never expose or reflow a player's hidden rolling rows. */
  const alignCaptionWindows = (windows: Set<HTMLElement>, video: HTMLVideoElement | undefined) => {
    if (stableBoxLayout) return;
    const bounds = videoBounds(video);
    const gutter = Math.min(bounds.width / 4, Math.max(12, bounds.width * 0.04));
    const center = bounds.left + bounds.width / 2;
    for (const element of windows) {
      let parent = composedParent(element);
      while (parent && !windows.has(parent)) parent = composedParent(parent);
      if (parent) continue; // Overlapping selectors must not scale nested windows twice.
      const originalRect = horizontal === 'preserve' ? element.getBoundingClientRect() : undefined;
      const originalCenter = originalRect ? originalRect.left + originalRect.width / 2 : center;
      if (vertical === 'bottom') {
        setLayout(element, {
          position: 'fixed', top: 'auto',
          bottom: `${String(innerHeight - bounds.bottom + bottomInset(bounds.height))}px`,
          'margin-top': '0', 'margin-bottom': '0',
          transform: 'none', translate: 'none', rotate: 'none',
        });
      }
      if (boxScaling) {
        // Individual scale leaves cached font sizes, clipped window height, and
        // descendant roll-up transforms intact. The player cannot read back an
        // App-multiplied font and multiply it again on the next partial cue.
        setLayout(element, { scale: String(scale), 'transform-origin': '50% 100%' });
      }
      if (horizontal === 'center') {
        if (vertical === 'bottom') {
          setLayout(element, { left: `${String(bounds.left)}px`, right: 'auto' });
        }
        setLayout(element, {
          'box-sizing': 'border-box', 'text-align': 'center', 'min-width': '0',
          'max-width': `${String((bounds.width - gutter * 2) / (boxScaling ? scale : 1))}px`,
        });
        centerHorizontally(element, center);
      } else if (vertical === 'bottom') {
        centerHorizontally(element, originalCenter);
      }
    }
  };
  /** Native caption replacement/layout writes receive PiP geometry in the same paint. */
  const captionBoxCss = (video: HTMLVideoElement | undefined): string => {
    if (!stableBoxLayout || !captionSelector) return '';
    const bounds = videoBounds(video);
    const gutter = Math.min(bounds.width / 4, Math.max(12, bounds.width * 0.04));
    const windowSelector = `:is(${captionSelector})`;
    const ratio = video && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1;
    // CSS viewport units fit PiP immediately during a native resize, rather
    // than holding old pixel coordinates until a renderer resize/RAF callback.
    const imageWidth = `min(100vw,calc(100vh * ${String(ratio)}))`;
    const imageHeight = `min(100vh,calc(100vw / ${String(ratio)}))`;
    const responsiveGutter = `min(calc(${imageWidth} * .25),max(12px,calc(${imageWidth} * .04)))`;
    const responsiveGap = `max(calc(${imageHeight} * ${String(bounded(options.alignment?.bottomInsetRatio, 0.08, 0.4))}),` +
      `min(calc(${imageHeight} * .25),${String(bounded(options.alignment?.minimumBottomInsetPx, 12, 200))}px))`;
    const left = bounds.viewportFitted ? '50vw' : `calc(50vw + ${String(bounds.left + bounds.width / 2 - innerWidth / 2)}px)`;
    const bottom = bounds.viewportFitted
      ? `calc((100vh - ${imageHeight}) / 2 + ${responsiveGap})`
      : `${String(innerHeight - bounds.bottom + bottomInset(bounds.height))}px`;
    const maximumWidth = bounds.viewportFitted
      ? `calc((${imageWidth} - ${responsiveGutter} * 2) / ${String(scale)})`
      : `${String((bounds.width - gutter * 2) / scale)}px`;
    // Only outer windows scale: overlapping declarations and nested buffers
    // must not multiply the caption scale or change internal scrolling layers.
    return `${windowSelector}:not(${windowSelector} ${windowSelector}){` +
      'position:fixed!important;top:auto!important;right:auto!important;' +
      `left:${left}!important;bottom:${bottom}!important;` +
      'margin:0!important;' +
      'transform:none!important;translate:-50% 0px!important;rotate:none!important;' +
      `scale:${String(scale)}!important;transform-origin:50% 100%!important;transform-box:border-box!important;` +
      'box-sizing:border-box!important;text-align:center!important;min-width:0!important;' +
      `max-width:${maximumWidth}!important}`;
  };
  /** A shadow subtree inside an outer caption window inherits that window's scale. */
  const nestedCaptionRoot = (root: Document | ShadowRoot): boolean => {
    if (!(root instanceof ShadowRoot) || !(root.host instanceof HTMLElement) || !captionSelector) return false;
    for (let parent: HTMLElement | null = root.host; parent; parent = composedParent(parent)) {
      if (parent.matches(captionSelector)) return true;
    }
    return false;
  };
  /** Include newly created open shadow roots without touching closed player internals. */
  const collectRoots = (): Array<Document | ShadowRoot> => {
    const roots: Array<Document | ShadowRoot> = [document];
    for (let index = 0; index < roots.length; index += 1) {
      for (const element of Array.from(roots[index].querySelectorAll('*'))) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    return roots;
  };
  /** At most one automatic update per paint; never starve video frames with microtasks. */
  const schedule = () => {
    if (scheduled !== undefined || disposed) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = undefined;
      if (!disposed) apply();
    });
  };
  const videoSizeObserver = new ResizeObserver(schedule);
  /** Ignore App style/controls mutations rather than reacting to our PiP engine. */
  const isAppNode = (element: Element) => element.matches(
    '[data-kawaikara-subtitle-style],[data-kawaikara-unified-pip-controls],' +
    '[data-kawaikara-unified-pip-shadow],[data-kawaikara-unified-pip-overlay],' +
    '[data-kawaikara-unified-pip-backdrop]',
  );
  /** Recognize retained caption nodes even after a player removes their class. */
  const isCaption = (element: Element) =>
    (element instanceof HTMLElement && observedCaptions.has(element)) ||
    Boolean(captionSelector && element.matches(captionSelector));
  /** Selector-based box CSS already handles native text/inline writes before paint. */
  const insideCaption = (element: Element): boolean => {
    for (let current: Element | null = element; current;) {
      if (isAppNode(current)) return false;
      if (isCaption(current)) return true;
      current = current instanceof HTMLElement ? composedParent(current) : current.parentElement;
    }
    return false;
  };
  /** Text/attributes inside captions or on their geometry/font ancestors matter. */
  const affectsCaptions = (element: Element) => {
    for (let current: Element | null = element; current;) {
      if (isAppNode(current)) return false;
      if (isCaption(current)) return true;
      current = current instanceof HTMLElement ? composedParent(current) : current.parentElement;
    }
    for (const caption of observedCaptions) {
      if (element.contains(caption)) return true;
      for (let parent = composedParent(caption); parent; parent = composedParent(parent)) {
        if (parent === element) return true;
      }
    }
    return false;
  };
  /** Scan only a changed subtree, not the whole YouTube page/comments/live chat. */
  const changedSubtree = (node: Node) => {
    if (!(node instanceof Element) || isAppNode(node)) return false;
    let relevant = isCaption(node) || Boolean(captionSelector && node.querySelector(captionSelector));
    if (node.shadowRoot) { rootsDirty = true; relevant = true; }
    for (const element of Array.from(node.querySelectorAll('*'))) {
      if (element.shadowRoot) { rootsDirty = true; relevant = true; break; }
    }
    for (const caption of observedCaptions) {
      if (node.contains(caption)) { relevant = true; break; }
    }
    return relevant;
  };
  /** Only actual caption/style/Shadow DOM changes require a typography/layout pass. */
  const observer = new MutationObserver((mutations) => {
    let relevant = false;
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target && isAppNode(target)) continue;
      if (mutation.type === 'attributes' && target &&
          target.getAttribute(mutation.attributeName!) === mutation.oldValue) continue;
      if (stableBoxLayout && target && target.tagName !== 'STYLE' && insideCaption(target) && (
        mutation.type === 'characterData' ||
        (mutation.type === 'attributes' && mutation.attributeName === 'style') ||
        (mutation.type === 'childList' && [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
          .every(node => node.nodeType === Node.TEXT_NODE))
      )) continue;
      if (target && (target.tagName === 'STYLE' || affectsCaptions(target))) relevant = true;
      if (mutation.type === 'childList') {
        // Do not short-circuit: every added/removed shadow host invalidates roots.
        for (const node of [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]) {
          if (changedSubtree(node)) relevant = true;
        }
      }
    }
    if (relevant) schedule();
  });
  /** Native captions use cue settings, not DOM text-align or copied page markup. */
  const centerNativeCues = (video: HTMLVideoElement | undefined) => {
    const currentTracks = new Set<TextTrack>();
    const activeCues = new Set<VTTCue>();
    if (video && options.nativeCues !== false && (horizontal !== 'preserve' || vertical === 'bottom')) {
      for (let index = 0; index < video.textTracks.length; index += 1) {
        const track = video.textTracks[index];
        currentTracks.add(track);
        if (!tracks.has(track)) {
          tracks.add(track);
          track.addEventListener('cuechange', schedule);
        }
        if (track.mode !== 'showing') continue;
        for (let cueIndex = 0; cueIndex < (track.activeCues?.length ?? 0); cueIndex += 1) {
          const cue = track.activeCues![cueIndex];
          // Vertical writing and region-based/speaker layouts require the player's adapter.
          if (!(cue instanceof VTTCue) || cue.vertical || cue.region) continue;
          activeCues.add(cue);
          let snapshot = savedCues.get(cue);
          if (!snapshot) {
            snapshot = {
              align: cue.align, position: cue.position,
              positionAlign: typeof cue.positionAlign === 'string' ? cue.positionAlign : undefined, size: cue.size,
            };
            savedCues.set(cue, snapshot);
          }
          // Updating VTTCue settings can itself emit cuechange in Chromium.
          // Write only changed values; otherwise alignment schedules itself forever.
          if (horizontal === 'center' && cue.align !== 'center') { snapshot.align = cue.align; cue.align = 'center'; }
          if (horizontal === 'center' && cue.position !== 50) { snapshot.position = cue.position; cue.position = 50; }
          if (horizontal === 'center' && typeof cue.positionAlign === 'string' && cue.positionAlign !== 'center') {
            snapshot.positionAlign = cue.positionAlign;
            cue.positionAlign = 'center';
          }
          if (horizontal === 'center' && cue.size !== 92) { snapshot.size = cue.size; cue.size = 92; }
          if (vertical === 'bottom' && typeof cue.lineAlign === 'string') {
            const bounds = videoBounds(video);
            const line = 100 * (1 - bottomInset(bounds.height) / bounds.height);
            let original = snapshot.bottomPlacement;
            if (!original) {
              original = snapshot.bottomPlacement = {
                line: cue.line, snapToLines: cue.snapToLines, lineAlign: cue.lineAlign, appliedLine: line,
              };
            } else {
              if (cue.line !== original.appliedLine) original.line = cue.line;
              if (cue.snapToLines) original.snapToLines = cue.snapToLines;
              if (cue.lineAlign !== 'end') original.lineAlign = cue.lineAlign;
            }
            if (cue.snapToLines) cue.snapToLines = false;
            if (cue.lineAlign !== 'end') cue.lineAlign = 'end';
            if (cue.line !== line) cue.line = line;
            original.appliedLine = line;
          }
        }
      }
    }
    for (const [cue, snapshot] of savedCues) {
      if (activeCues.has(cue)) continue;
      savedCues.delete(cue);
      restoreCue(cue, snapshot);
    }
    for (const track of tracks) {
      if (currentTracks.has(track)) continue;
      track.removeEventListener('cuechange', schedule);
      tracks.delete(track);
    }
  };
  /** Reapply an absolute scale to all caption text, never to unrelated page text. */
  const apply = () => {
    if (scheduled !== undefined) { cancelAnimationFrame(scheduled); scheduled = undefined; }
    observer.disconnect();
    restoreText();
    restoreLayout();
    if (rootsDirty) { observedRoots = collectRoots(); rootsDirty = false; }
    const roots = observedRoots;
    const targets = new Set<HTMLElement>();
    const overlays = new Set<HTMLElement>();
    const windows = new Set<HTMLElement>();
    const reveal = selectors.map((selector) =>
      `${selector},${selector} *{visibility:visible!important;pointer-events:none!important;z-index:2147483647!important}`,
    ).join('\n');
    const cueBase = options.nativeCueFontSize ?? '5vh';
    const cueSize = `calc(${cueBase} * ${String(scale)})`;
    const activeVideo = pageWindow.__kawaikaraUnifiedPictureInPicture?.video;
    const boxCss = captionBoxCss(activeVideo);
    const cues = options.nativeCues !== false && scale !== 1 &&
      CSS.supports('font-size', cueSize)
      ? `video[${marker}]::cue{font-size:${cueSize}!important}` : '';
    for (const root of roots) {
      let style = styles.get(root);
      if (!style) {
        style = document.createElement('style');
        style.dataset.kawaikaraSubtitleStyle = options.id;
        styles.set(root, style);
      }
      if (!style.isConnected) (root instanceof Document ? root.head ?? root.documentElement : root).appendChild(style);
      const css = `${reveal}\n${cues}\n${boxCss && !nestedCaptionRoot(root) ? boxCss : ''}`;
      if (style.textContent !== css) style.textContent = css;
      if (!boxScaling || alignmentSelectors === undefined) {
        for (const selector of selectors) {
          for (const overlay of Array.from(root.querySelectorAll(selector))) {
            if (overlay instanceof HTMLElement) overlays.add(overlay);
          }
        }
      }
      for (const selector of alignmentSelectors ?? []) {
        for (const element of Array.from(root.querySelectorAll(selector))) {
          if (element instanceof HTMLElement) windows.add(element);
        }
      }
      // Rolling-window scaling never discovers or measures descendant text.
      if (!boxScaling && textSelectors) {
        for (const selector of textSelectors) {
          for (const element of Array.from(root.querySelectorAll(selector))) {
            if (element instanceof HTMLElement) targets.add(element);
          }
        }
      } else if (!boxScaling) {
        for (const selector of selectors) {
          for (const overlay of Array.from(root.querySelectorAll(selector))) {
            for (const element of [overlay, ...Array.from(overlay.querySelectorAll('*'))]) {
              if (element instanceof HTMLElement &&
                  Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
                targets.add(element);
              }
            }
          }
        }
      }
    }
    observedCaptions = new Set([...overlays, ...windows, ...targets]);
    if (layoutVideo !== activeVideo) {
      videoSizeObserver.disconnect();
      layoutVideo?.removeEventListener('resize', schedule);
      layoutVideo?.textTracks.removeEventListener('addtrack', schedule);
      layoutVideo?.textTracks.removeEventListener('removetrack', schedule);
      layoutVideo?.textTracks.removeEventListener('change', schedule);
      layoutVideo = activeVideo;
      if (layoutVideo) videoSizeObserver.observe(layoutVideo);
      layoutVideo?.addEventListener('resize', schedule);
      layoutVideo?.textTracks.addEventListener('addtrack', schedule);
      layoutVideo?.textTracks.addEventListener('removetrack', schedule);
      layoutVideo?.textTracks.addEventListener('change', schedule);
    }
    for (const [video, original] of markedVideos) {
      if (video === activeVideo) continue;
      if (original === null) video.removeAttribute(marker);
      else video.setAttribute(marker, original);
      markedVideos.delete(video);
    }
    if (activeVideo && options.nativeCues !== false && !markedVideos.has(activeVideo)) {
      markedVideos.set(activeVideo, activeVideo.getAttribute(marker));
      activeVideo.setAttribute(marker, '');
    }
    // Measure every target BEFORE writing any ancestor font size. This also
    // handles captions with both parent text and nested explicitly sized spans.
    const measurements = [...targets].filter((element) => element.isConnected).map((element) => {
      const computed = getComputedStyle(element);
      return { element, font: parseFloat(computed.fontSize), line: parseFloat(computed.lineHeight) };
    });
    centerNativeCues(activeVideo);
    if (scale !== 1 && !boxScaling) {
      for (const { element, font, line } of measurements) {
        if (!Number.isFinite(font) || font <= 0) continue;
        const snapshot: SavedText = {
          font: capture(element, 'font-size'),
          line: capture(element, 'line-height'),
          hadStyle: element.hasAttribute('style'),
        };
        element.style.setProperty('font-size', `${String(font * scale)}px`, 'important');
        snapshot.font.applied = element.style.getPropertyValue('font-size');
        if (Number.isFinite(line) && line > 0) {
          element.style.setProperty('line-height', `${String(line * scale)}px`, 'important');
          snapshot.line.applied = element.style.getPropertyValue('line-height');
        }
        saved.set(element, snapshot);
      }
    }
    if (options.alignment !== undefined || alignmentSelectors !== undefined || boxScaling || vertical === 'bottom') {
      alignCaptionWindows(alignmentSelectors !== undefined ? windows : overlays, activeVideo);
    } else {
      centerLayout(overlays, activeVideo);
    }
    for (const [root, style] of styles) {
      if (!roots.includes(root)) { style.remove(); styles.delete(root); }
    }
    for (const root of roots) {
      observer.observe(root, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'style'], attributeOldValue: true,
      });
    }
  };
  states[options.id] = {
    update(value: number) { scale = value; apply(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (scheduled !== undefined) { cancelAnimationFrame(scheduled); scheduled = undefined; }
      observer.disconnect();
      videoSizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('kawaikara:picture-in-picture-transition', schedule);
      layoutVideo?.removeEventListener('resize', schedule);
      layoutVideo?.textTracks.removeEventListener('addtrack', schedule);
      layoutVideo?.textTracks.removeEventListener('removetrack', schedule);
      layoutVideo?.textTracks.removeEventListener('change', schedule);
      for (const track of tracks) track.removeEventListener('cuechange', schedule);
      tracks.clear();
      restoreText();
      restoreLayout();
      restoreCues();
      for (const style of styles.values()) style.remove();
      for (const [video, original] of markedVideos) {
        if (original === null) video.removeAttribute(marker);
        else video.setAttribute(marker, original);
      }
      styles.clear();
      markedVideos.clear();
    },
  };
  window.addEventListener('resize', schedule);
  document.addEventListener('kawaikara:picture-in-picture-transition', schedule);
  apply();
}
