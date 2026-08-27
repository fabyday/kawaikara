import {
  serializePageInjection,
  serializePageInjectionWithOptions,
} from './Serialize';

/** Describes the unified picture in picture element snapshot contract. */
interface UnifiedPictureInPictureElementSnapshot {
  /** The element value. */
  readonly element: HTMLElement;
  /** The marker value. */
  readonly marker: string | null;
  /** The style value. */
  readonly style: string | null;
}

/** Describes the unified picture in picture page state contract. */
interface UnifiedPictureInPicturePageState {
  /** The backdrop value. */
  readonly backdrop: HTMLElement;
  /** Whether the controls option is enabled. */
  controls: boolean;
  /** The controls style value. */
  readonly controlsStyle: HTMLStyleElement;
  /** The controls style text value. */
  readonly controlsStyleText: string;
  /** The elements value. */
  elements: UnifiedPictureInPictureElementSnapshot[];
  /** Whether the layout released option is enabled. */
  layoutReleased: boolean;
  /** The navigation controls style text value. */
  readonly navigationControlsStyleText: string;
  /** The navigation offset x value. */
  navigationOffsetX: number;
  /** The navigation offset y value. */
  navigationOffsetY: number;
  /** The overlay value. */
  readonly overlay: HTMLElement;
  /** The playback button value. */
  readonly playbackButton: HTMLButtonElement;
  /** Callback used to handle release layout for navigation. */
  readonly releaseLayoutForNavigation: () => void;
  /** Callback used to handle render playback button. */
  readonly renderPlaybackButton: () => void;
  /** Callback used to handle restore layout after navigation. */
  readonly restoreLayoutAfterNavigation: () => void;
  /** The shadow observer value. */
  readonly shadowObserver: MutationObserver;
  /** The shadow styles value. */
  readonly shadowStyles: HTMLStyleElement[];
  /** Callback used to handle synchronize video path. */
  readonly synchronizeVideoPath: () => void;
  /** The video value. */
  video: HTMLVideoElement;
  /** The video marker value. */
  videoMarker: string | null;
}

/** Describes the unified picture in picture page global contract. */
interface UnifiedPictureInPicturePageGlobal extends Window {
  /** The Kawaikara unified picture in picture value. */
  __kawaikaraUnifiedPictureInPicture?: UnifiedPictureInPicturePageState;
}

/** Describes the enter unified picture in picture options contract. */
interface EnterUnifiedPictureInPictureOptions {
  /** The content overlay selectors value. */
  readonly contentOverlaySelectors: readonly string[];
  /** The native drag style value. */
  readonly nativeDragStyle: string;
  /** The native no drag style value. */
  readonly nativeNoDragStyle: string;
  /** The playback button size value. */
  readonly playbackButtonSize: number;
  /** The playback message value. */
  readonly playbackMessage: string;
  /** The restore message value. */
  readonly restoreMessage: string;
}

/** Describes the unified picture in picture page result contract. */
interface UnifiedPictureInPicturePageResult {
  /** The status value. */
  readonly status:
    | 'entered'
    | 'missing'
    | 'no-video'
    | 'not-ready'
    | 'refreshed'
    | 'unchanged';
  /** The video height value. */
  readonly videoHeight?: number;
  /** The video width value. */
  readonly videoWidth?: number;
}

/**
 * Page-world PiP entry point.
 *
 * Serialized by createEnterUnifiedPictureInPictureScript() below and executed
 * by UnifiedPictureInPictureManager.enter() in
 * src/Main/Manager/UnifiedPictureInPictureManager.ts. The Manager supplies
 * Provider subtitle selectors and native-window control messages; this
 * function owns only remote-document DOM state.
 */
function enterUnifiedPictureInPicture(
  options: EnterUnifiedPictureInPictureOptions,
): UnifiedPictureInPicturePageResult {
  const pageWindow = window as UnifiedPictureInPicturePageGlobal;
  const existing = pageWindow.__kawaikaraUnifiedPictureInPicture;
  if (existing) {
    return {
      /** The status value. */
      status: 'entered',
      /** The video height value. */
      videoHeight: existing.video.videoHeight,
      /** The video width value. */
      videoWidth: existing.video.videoWidth,
    };
  }
  document.dispatchEvent(new Event('kawaikara:picture-in-picture-transition'));

  const videos: HTMLVideoElement[] = [];
  /** Performs the visit operation. */
  const visit = (root: Document | ShadowRoot): void => {
    root.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      videos.push(video);
    });
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  /** Performs the score operation. */
  const score = (video: HTMLVideoElement): number => {
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
    );
    return (
      (!video.paused && !video.ended ? 1e15 : 0) +
      (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
      visibleWidth * visibleHeight
    );
  };
  /** Performs the composed parent element operation. */
  const composedParentElement = (element: HTMLElement): HTMLElement | null => {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot && root.host instanceof HTMLElement
      ? root.host
      : null;
  };
  /** Performs the capture path operation. */
  const capturePath = (
    video: HTMLVideoElement,
  ): UnifiedPictureInPictureElementSnapshot[] => {
    const elements: UnifiedPictureInPictureElementSnapshot[] = [];
    for (
      let element: HTMLElement | null = video;
      element;
      element = composedParentElement(element)
    ) {
      elements.push({
        element,
        marker: element.getAttribute(
          'data-kawaikara-unified-pip-video-path',
        ),
        style: element.getAttribute('style'),
      });
      element.setAttribute('data-kawaikara-unified-pip-video-path', 'true');
    }
    return elements;
  };
  /** Performs the expose video path operation. */
  const exposeVideoPath = (
    video: HTMLVideoElement,
    elements: readonly UnifiedPictureInPictureElementSnapshot[],
  ): void => {
    for (const { element } of elements) {
      element.setAttribute('data-kawaikara-unified-pip-video-path', 'true');
      element.style.setProperty('transform', 'none', 'important');
      element.style.setProperty('filter', 'none', 'important');
      element.style.setProperty('perspective', 'none', 'important');
      element.style.setProperty('contain', 'none', 'important');
      element.style.setProperty('clip-path', 'none', 'important');
      if (element === document.body || element === document.documentElement) {
        element.style.setProperty('position', 'fixed', 'important');
        element.style.setProperty('inset', '0', 'important');
        element.style.setProperty('width', 'auto', 'important');
        element.style.setProperty('height', 'auto', 'important');
        element.style.setProperty('overflow', 'clip', 'important');
      }
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('z-index', '2147483647', 'important');
    }
    video.style.setProperty('position', 'fixed', 'important');
    video.style.setProperty('inset', '0', 'important');
    video.style.setProperty('box-sizing', 'border-box', 'important');
    video.style.setProperty('width', '100%', 'important');
    video.style.setProperty('height', '100%', 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('max-height', 'none', 'important');
    video.style.setProperty('margin', '0', 'important');
    video.style.setProperty('padding', '0', 'important');
    video.style.setProperty('border', '0', 'important');
    video.style.setProperty('object-fit', 'contain', 'important');
    video.style.setProperty('background', '#000', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('z-index', '2147483646', 'important');
  };
  /** Restores the snapshots. */
  const restoreSnapshots = (
    elements: readonly UnifiedPictureInPictureElementSnapshot[],
  ): void => {
    for (const { element, marker, style } of elements) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
      if (marker === null) {
        element.removeAttribute('data-kawaikara-unified-pip-video-path');
      } else {
        element.setAttribute(
          'data-kawaikara-unified-pip-video-path',
          marker,
        );
      }
    }
  };

  visit(document);
  videos.sort((left, right) => score(right) - score(left));
  const video = videos[0];
  if (!video) return {
    /** The status value. */
    status: 'no-video',
  };
  if (
    video.readyState === HTMLMediaElement.HAVE_NOTHING ||
    !video.videoWidth
  ) {
    return {
      /** The status value. */
      status: 'not-ready',
    };
  }

  const videoMarker = video.getAttribute('data-kawaikara-unified-pip-video');
  video.setAttribute('data-kawaikara-unified-pip-video', 'true');
  const elements = capturePath(video);
  exposeVideoPath(video, elements);

  const backdrop = document.createElement('div');
  backdrop.dataset.kawaikaraUnifiedPipBackdrop = 'true';
  backdrop.style.cssText = [
    'position:fixed!important',
    'inset:0!important',
    'box-sizing:border-box!important',
    'margin:0!important',
    'padding:0!important',
    'border:0!important',
    'background:#000!important',
    'z-index:2147483645!important',
    'pointer-events:none!important',
  ].join(';');
  document.body.append(backdrop);

  const contentOverlayStyleText = options.contentOverlaySelectors
    .map((selector) =>
      `body ${selector},body ${selector} *{visibility:visible!important;` +
      'pointer-events:none!important;z-index:2147483647!important}',
    )
    .join('');
  const shadowContentOverlayStyleText = options.contentOverlaySelectors
    .map((selector) =>
      `${selector},${selector} *{visibility:visible!important;` +
      'pointer-events:none!important;z-index:2147483647!important}',
    )
    .join('');
  const videoStyleText =
    'position:fixed!important;inset:0!important;box-sizing:border-box!important;' +
    'width:100%!important;height:100%!important;margin:0!important;' +
    'padding:0!important;border:0!important;max-width:none!important;' +
    'max-height:none!important;' +
    'object-fit:contain!important;background:#000!important;' +
    'visibility:visible!important;pointer-events:none!important;' +
    'z-index:2147483646!important';
  const shadowControlsStyleText =
    ':host *{visibility:hidden!important;pointer-events:none!important}' +
    `video[data-kawaikara-unified-pip-video="true"]{${videoStyleText}}` +
    shadowContentOverlayStyleText;
  const controlsStyleText =
    'html,body{position:fixed!important;inset:0!important;' +
    'box-sizing:border-box!important;width:auto!important;height:auto!important;' +
    'min-width:0!important;min-height:0!important;' +
    'margin:0!important;padding:0!important;border:0!important;' +
    'overflow:clip!important;scrollbar-gutter:auto!important;' +
    'overscroll-behavior:none!important}' +
    'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;' +
    'width:0!important;height:0!important}' +
    'body *{visibility:hidden!important;pointer-events:none!important}' +
    'body [data-kawaikara-unified-pip-backdrop="true"]{visibility:visible!important;' +
    'pointer-events:none!important}' +
    'body [data-kawaikara-unified-pip-video-path="true"]{' +
    'transform:none!important;filter:none!important;perspective:none!important;' +
    'contain:none!important;clip-path:none!important;opacity:1!important}' +
    `body video[data-kawaikara-unified-pip-video="true"]{${videoStyleText}}` +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls,' +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-enclosure,' +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-panel,' +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-timeline,' +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-current-time-display,' +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-time-remaining-display' +
    '{display:none!important;opacity:0!important;visibility:hidden!important}' +
    contentOverlayStyleText;
  const navigationControlsStyleText =
    'body [data-kawaikara-unified-pip-backdrop="true"]{visibility:visible!important;' +
    'pointer-events:none!important}' +
    `body video[data-kawaikara-unified-pip-video="true"]{${videoStyleText}}` +
    'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls{' +
    'display:none!important;opacity:0!important;visibility:hidden!important}' +
    contentOverlayStyleText;
  const controlsStyle = document.createElement('style');
  controlsStyle.dataset.kawaikaraUnifiedPipControls = 'true';
  controlsStyle.textContent = controlsStyleText;
  document.head.append(controlsStyle);

  const shadowStyles: HTMLStyleElement[] = [];
  const styledShadowRoots = new WeakSet<ShadowRoot>();
  /** Installs the shadow style. */
  const installShadowStyle = (root: ShadowRoot): void => {
    if (styledShadowRoots.has(root)) return;
    styledShadowRoots.add(root);
    const style = document.createElement('style');
    style.dataset.kawaikaraUnifiedPipShadow = 'true';
    style.textContent = shadowControlsStyleText;
    root.append(style);
    shadowStyles.push(style);
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) installShadowStyle(element.shadowRoot);
    });
  };
  /** Performs the scan shadow roots operation. */
  const scanShadowRoots = (root: ParentNode | Element): void => {
    if (root instanceof Element && root.shadowRoot) {
      installShadowStyle(root.shadowRoot);
    }
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) installShadowStyle(element.shadowRoot);
    });
  };
  /** Performs the synchronize video path operation. */
  const synchronizeVideoPath = (): void => {
    const activeState = pageWindow.__kawaikaraUnifiedPictureInPicture;
    if (!activeState) return;
    const knownElements = new Set(
      activeState.elements.map(({ element }) => element),
    );
    for (
      let element: HTMLElement | null = activeState.video;
      element;
      element = composedParentElement(element)
    ) {
      if (knownElements.has(element)) continue;
      activeState.elements.push({
        element,
        marker: element.getAttribute(
          'data-kawaikara-unified-pip-video-path',
        ),
        style: element.getAttribute('style'),
      });
      knownElements.add(element);
    }
    // CHZZK reuses the video while replacing its viewer/video-area ancestors.
    // Reapply the full path after every replacement so a newly mounted
    // transform cannot become the fixed video's containing block.
    exposeVideoPath(activeState.video, activeState.elements);
  };
  scanShadowRoots(document);
  const shadowObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scanShadowRoots(node);
      });
    }
    requestAnimationFrame(synchronizeVideoPath);
  });
  shadowObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  /** Performs the maintain navigation video position operation. */
  const maintainNavigationVideoPosition = (): void => {
    const activeState = pageWindow.__kawaikaraUnifiedPictureInPicture;
    if (!activeState?.layoutReleased) return;
    const rect = activeState.video.getBoundingClientRect();
    activeState.navigationOffsetX -= rect.left;
    activeState.navigationOffsetY -= rect.top;
    activeState.video.style.setProperty(
      'transform',
      `translate(${String(activeState.navigationOffsetX)}px,` +
        `${String(activeState.navigationOffsetY)}px)`,
      'important',
    );
    requestAnimationFrame(maintainNavigationVideoPosition);
  };
  /** Restores the layout after navigation. */
  const restoreLayoutAfterNavigation = (): void => {
    const activeState = pageWindow.__kawaikaraUnifiedPictureInPicture;
    if (!activeState?.layoutReleased) return;
    const activeContainer = activeState.video.closest(
      '[is-active], [aria-current="true"], [class*="is_current"]',
    );
    if (!activeContainer && (activeState.video.paused || activeState.video.ended)) {
      return;
    }
    restoreSnapshots(activeState.elements);
    activeState.elements = capturePath(activeState.video);
    exposeVideoPath(activeState.video, activeState.elements);
    activeState.controlsStyle.textContent = activeState.controlsStyleText;
    activeState.layoutReleased = false;
    activeState.navigationOffsetX = 0;
    activeState.navigationOffsetY = 0;
  };
  /** Performs the release layout for navigation operation. */
  const releaseLayoutForNavigation = (): void => {
    const activeState = pageWindow.__kawaikaraUnifiedPictureInPicture;
    if (!activeState) return;
    restoreSnapshots(activeState.elements);
    activeState.controlsStyle.textContent = activeState.navigationControlsStyleText;
    activeState.layoutReleased = true;
    activeState.navigationOffsetX = 0;
    activeState.navigationOffsetY = 0;
    requestAnimationFrame(maintainNavigationVideoPosition);
  };

  const overlay = document.createElement('div');
  overlay.dataset.kawaikaraUnifiedPipOverlay = 'true';
  overlay.setAttribute('popover', 'manual');
  overlay.style.cssText =
    'all:initial!important;position:fixed!important;inset:0!important;' +
    'margin:0!important;padding:0!important;border:0!important;' +
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'z-index:2147483647!important;' +
    'pointer-events:auto!important';
  const shadow = overlay.attachShadow({ mode: 'closed'
  });
  const overlayStyle = document.createElement('style');
  overlayStyle.textContent =
    ':host{all:initial;display:block!important;visibility:visible!important;' +
    'opacity:1!important}.drag-surface{position:absolute;inset:0;cursor:move;' +
    options.nativeDragStyle + '}' +
    'button{position:absolute;width:40px;height:40px;padding:0;' +
    'border:1px solid rgba(255,255,255,.2);border-radius:12px;' +
    'background:rgba(12,12,14,.82);color:#fff;z-index:1;display:grid;' +
    'place-items:center;cursor:pointer;opacity:0;transform:scale(.92);' +
    'pointer-events:none;transition:opacity 140ms ease,transform 140ms ease,' +
    'background 140ms ease;box-shadow:0 8px 24px rgba(0,0,0,.35);' +
    'backdrop-filter:blur(12px);' + options.nativeNoDragStyle + '}' +
    '.restore-button{top:12px;left:12px}.playback-button{top:50%;left:50%;' +
    `width:${String(options.playbackButtonSize)}px;` +
    `height:${String(options.playbackButtonSize)}px;border-radius:50%;` +
    'transform:translate(-50%,-50%) scale(.92);background:rgba(12,12,14,.72)}' +
    ':host(:hover) button,:host([data-controls-visible="true"]) button,' +
    'button:hover,' +
    'button:focus-visible{opacity:1;transform:scale(1);pointer-events:auto}' +
    ':host(:hover) .playback-button,' +
    ':host([data-controls-visible="true"]) .playback-button,' +
    '.playback-button:hover,.playback-button:focus-visible{' +
    'transform:translate(-50%,-50%) scale(1)}' +
    'button:hover{background:rgba(38,38,43,.96)}' +
    'svg{width:22px;height:22px;fill:none;stroke:currentColor;' +
    'stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}';
  const dragSurface = document.createElement('div');
  dragSurface.className = 'drag-surface';
  dragSurface.setAttribute('aria-hidden', 'true');
  /** Creates the icon. */
  const createIcon = (paths: readonly string[]): SVGSVGElement => {
    const namespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(namespace, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    paths.forEach((pathData) => {
      const path = document.createElementNS(namespace, 'path');
      path.setAttribute('d', pathData);
      icon.append(path);
    });
    return icon;
  };
  const restoreButton = document.createElement('button');
  restoreButton.className = 'restore-button';
  restoreButton.type = 'button';
  restoreButton.title = 'Return to Kawaikara';
  restoreButton.setAttribute('aria-label', 'Return to Kawaikara');
  restoreButton.append(createIcon(['M9 5H5v14h14v-4', 'M11 5h8v8', 'm19 5-9 9']));
  const playbackButton = document.createElement('button');
  playbackButton.className = 'playback-button';
  playbackButton.type = 'button';
  /** Performs the active playback video operation. */
  const activePlaybackVideo = (): HTMLVideoElement =>
    pageWindow.__kawaikaraUnifiedPictureInPicture?.video ?? video;
  /** Renders the playback button. */
  const renderPlaybackButton = (): void => {
    const activeVideo = activePlaybackVideo();
    const paused = activeVideo.paused || activeVideo.ended;
    playbackButton.title = paused ? 'Play' : 'Pause';
    playbackButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    playbackButton.replaceChildren(
      createIcon([paused ? 'M8 5v14l11-7z' : 'M9 5v14M15 5v14']),
    );
  };
  /** Requests the playback toggle. */
  const requestPlaybackToggle = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.debug(options.playbackMessage);
  };
  playbackButton.addEventListener('click', requestPlaybackToggle);
  video.addEventListener('play', renderPlaybackButton);
  video.addEventListener('pause', renderPlaybackButton);
  video.addEventListener('ended', renderPlaybackButton);
  renderPlaybackButton();
  shadow.append(overlayStyle, dragSurface, restoreButton, playbackButton);
  restoreButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.debug(options.restoreMessage);
  });
  document.documentElement.append(overlay);
  if (typeof overlay.showPopover === 'function') {
    try {
      overlay.showPopover();
    } catch {
      // The maximum-z-index fixed overlay remains the compatibility path.
    }
  }

  pageWindow.__kawaikaraUnifiedPictureInPicture = {
    backdrop,
    controls: video.controls,
    controlsStyle,
    controlsStyleText,
    elements,
    layoutReleased: false,
    navigationControlsStyleText,
    navigationOffsetX: 0,
    navigationOffsetY: 0,
    overlay,
    playbackButton,
    releaseLayoutForNavigation,
    renderPlaybackButton,
    restoreLayoutAfterNavigation,
    shadowObserver,
    shadowStyles,
    synchronizeVideoPath,
    video,
    videoMarker,
  };
  video.controls = false;
  return {
    /** The status value. */
    status: 'entered',
    /** The video height value. */
    videoHeight: video.videoHeight,
    /** The video width value. */
    videoWidth: video.videoWidth,
  };
}

/**
 * Rebinds an active unified PiP document to a replacement SPA video.
 *
 * Serialized below and called only by
 * UnifiedPictureInPictureManager.refreshActiveVideo() after its frame scanner
 * selects the same frame. Cross-frame replacement uses the entry function.
 */
function refreshUnifiedPictureInPictureVideo(): UnifiedPictureInPicturePageResult {
  const pageWindow = window as UnifiedPictureInPicturePageGlobal;
  const state = pageWindow.__kawaikaraUnifiedPictureInPicture;
  if (!state) return {
    /** The status value. */
    status: 'missing',
  };
  const videos: HTMLVideoElement[] = [];
  /** Performs the visit operation. */
  const visit = (root: Document | ShadowRoot): void => {
    root.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      videos.push(video);
    });
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  /** Performs the score operation. */
  const score = (video: HTMLVideoElement): number => {
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
    );
    return (
      (video.closest('[is-active], [aria-current="true"], [class*="is_current"]')
        ? 1e18
        : 0) +
      (!video.paused && !video.ended ? 1e15 : 0) +
      (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
      visibleWidth * visibleHeight
    );
  };
  visit(document);
  videos.sort((left, right) => score(right) - score(left));
  const video = videos[0];
  if (
    !video ||
    video.readyState === HTMLMediaElement.HAVE_NOTHING ||
    !video.videoWidth
  ) {
    return {
      /** The status value. */
      status: 'not-ready',
    };
  }
  if (video === state.video && !state.layoutReleased) {
    state.synchronizeVideoPath();
    return {
      /** The status value. */
      status: 'unchanged',
      /** The video height value. */
      videoHeight: video.videoHeight,
      /** The video width value. */
      videoWidth: video.videoWidth,
    };
  }

  state.video.controls = state.controls;
  state.video.removeEventListener('play', state.renderPlaybackButton);
  state.video.removeEventListener('pause', state.renderPlaybackButton);
  state.video.removeEventListener('ended', state.renderPlaybackButton);
  state.elements.forEach(({ element, marker, style }) => {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
    if (marker === null) {
      element.removeAttribute('data-kawaikara-unified-pip-video-path');
    } else {
      element.setAttribute('data-kawaikara-unified-pip-video-path', marker);
    }
  });
  if (state.videoMarker === null) {
    state.video.removeAttribute('data-kawaikara-unified-pip-video');
  } else {
    state.video.setAttribute('data-kawaikara-unified-pip-video', state.videoMarker);
  }

  /** Performs the composed parent element operation. */
  const composedParentElement = (element: HTMLElement): HTMLElement | null => {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot && root.host instanceof HTMLElement
      ? root.host
      : null;
  };
  const elements: UnifiedPictureInPictureElementSnapshot[] = [];
  const videoMarker = video.getAttribute('data-kawaikara-unified-pip-video');
  video.setAttribute('data-kawaikara-unified-pip-video', 'true');
  for (
    let element: HTMLElement | null = video;
    element;
    element = composedParentElement(element)
  ) {
    elements.push({
      element,
      marker: element.getAttribute('data-kawaikara-unified-pip-video-path'),
      style: element.getAttribute('style'),
    });
    element.setAttribute('data-kawaikara-unified-pip-video-path', 'true');
  }
  elements.forEach(({ element }) => {
    element.style.setProperty('transform', 'none', 'important');
    element.style.setProperty('filter', 'none', 'important');
    element.style.setProperty('perspective', 'none', 'important');
    element.style.setProperty('contain', 'none', 'important');
    element.style.setProperty('clip-path', 'none', 'important');
    if (element === document.body || element === document.documentElement) {
      element.style.setProperty('position', 'fixed', 'important');
      element.style.setProperty('inset', '0', 'important');
      element.style.setProperty('width', 'auto', 'important');
      element.style.setProperty('height', 'auto', 'important');
      element.style.setProperty('overflow', 'clip', 'important');
    }
    element.style.setProperty('opacity', '1', 'important');
    element.style.setProperty('z-index', '2147483647', 'important');
  });
  video.style.cssText +=
    ';position:fixed!important;inset:0!important;box-sizing:border-box!important;' +
    'width:100%!important;height:100%!important;margin:0!important;' +
    'padding:0!important;border:0!important;max-width:none!important;' +
    'max-height:none!important;' +
    'object-fit:contain!important;background:#000!important;' +
    'visibility:visible!important;z-index:2147483646!important';

  state.video = video;
  state.controls = video.controls;
  state.controlsStyle.textContent = state.controlsStyleText;
  state.elements = elements;
  state.layoutReleased = false;
  state.navigationOffsetX = 0;
  state.navigationOffsetY = 0;
  state.videoMarker = videoMarker;
  video.controls = false;
  video.addEventListener('play', state.renderPlaybackButton);
  video.addEventListener('pause', state.renderPlaybackButton);
  video.addEventListener('ended', state.renderPlaybackButton);
  state.renderPlaybackButton();
  return {
    /** The status value. */
    status: 'refreshed',
    /** The video height value. */
    videoHeight: video.videoHeight,
    /** The video width value. */
    videoWidth: video.videoWidth,
  };
}

/** Describes the enter unified picture in picture host options contract. */
interface EnterUnifiedPictureInPictureHostOptions {
  /** The child frame URL value. */
  readonly childFrameUrl: string;
}

/**
 * Exposes the iframe ancestry that contains the selected PiP video frame.
 *
 * Serialized below and invoked by UnifiedPictureInPictureManager.enterHostFrames()
 * once per parent WebFrameMain. Its inverse lives in
 * PictureInPictureControls.exitUnifiedPictureInPictureHost() and is called by
 * UnifiedPictureInPictureManager.restoreHostFrames().
 */
function enterUnifiedPictureInPictureHost(
  options: EnterUnifiedPictureInPictureHostOptions,
): {
  /** The status value. */
  readonly status: 'entered' | 'no-frame';
} {
  /** Describes the host snapshot contract. */
  interface HostSnapshot {
    /** The element value. */
    readonly element: HTMLElement;
    /** The marker value. */
    readonly marker: string | null;
    /** The style value. */
    readonly style: string | null;
  }
  /** Describes the host state contract. */
  interface HostState {
    /** The elements value. */
    readonly elements: readonly HostSnapshot[];
    /** The style value. */
    readonly style: HTMLStyleElement;
  }
  const pageWindow = window as Window & {
    __kawaikaraUnifiedPictureInPictureHost?: HostState;
  };
  if (pageWindow.__kawaikaraUnifiedPictureInPictureHost) {
    return {
      /** The status value. */
      status: 'entered',
    };
  }
  const desiredUrl = new URL(options.childFrameUrl);
  const candidates = Array.from(
    document.querySelectorAll<HTMLIFrameElement>('iframe'),
  )
    .filter((frame) => {
      try {
        const frameUrl = new URL(frame.src, location.href);
        return frameUrl.origin === desiredUrl.origin &&
          frameUrl.pathname === desiredUrl.pathname;
      } catch {
        return false;
      }
    });
  const target = candidates.find((frame) => {
    try {
      const frameUrl = new URL(frame.src, location.href);
      return [...desiredUrl.searchParams].some(
        ([key, value]) => frameUrl.searchParams.get(key) === value,
      );
    } catch {
      return false;
    }
  }) ?? candidates[0];
  if (!target) return {
    /** The status value. */
    status: 'no-frame',
  };

  const elements: HostSnapshot[] = [];
  for (
    let element: HTMLElement | null = target;
    element;
    element = element.parentElement
  ) {
    elements.push({
      element,
      marker: element.getAttribute('data-kawaikara-unified-pip-host-path'),
      style: element.getAttribute('style'),
    });
    element.setAttribute('data-kawaikara-unified-pip-host-path', 'true');
    for (const property of [
      'transform',
      'filter',
      'perspective',
      'contain',
      'clip-path',
    ]) {
      element.style.setProperty(property, 'none', 'important');
    }
    if (element === document.body || element === document.documentElement) {
      element.style.setProperty('position', 'fixed', 'important');
      element.style.setProperty('inset', '0', 'important');
      element.style.setProperty('width', 'auto', 'important');
      element.style.setProperty('height', 'auto', 'important');
      element.style.setProperty('overflow', 'clip', 'important');
    } else {
      element.style.setProperty('overflow', 'visible', 'important');
    }
    element.style.setProperty('opacity', '1', 'important');
    element.style.setProperty('visibility', 'visible', 'important');
    element.style.setProperty('z-index', '2147483647', 'important');
  }
  target.style.cssText +=
    ';position:fixed!important;inset:0!important;box-sizing:border-box!important;' +
    'width:100%!important;height:100%!important;margin:0!important;' +
    'padding:0!important;max-width:none!important;max-height:none!important;' +
    'border:0!important;background:#000!important';
  const style = document.createElement('style');
  style.dataset.kawaikaraUnifiedPipHost = 'true';
  style.textContent =
    'html,body{position:fixed!important;inset:0!important;' +
    'box-sizing:border-box!important;width:auto!important;height:auto!important;' +
    'min-width:0!important;min-height:0!important;' +
    'margin:0!important;padding:0!important;border:0!important;' +
    'overflow:clip!important;scrollbar-gutter:auto!important;' +
    'background:#000!important}' +
    'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;' +
    'width:0!important;height:0!important}body *{visibility:hidden!important;' +
    'pointer-events:none!important}' +
    'body [data-kawaikara-unified-pip-host-path="true"]{' +
    'visibility:visible!important}' +
    'body iframe[data-kawaikara-unified-pip-host-path="true"]{' +
    'pointer-events:auto!important}';
  document.head.append(style);
  pageWindow.__kawaikaraUnifiedPictureInPictureHost = { elements, style
  };
  return {
    /** The status value. */
    status: 'entered',
  };
}

/** Creates the enter unified picture in picture script. */
export function createEnterUnifiedPictureInPictureScript(
  options: EnterUnifiedPictureInPictureOptions,
): string {
  return serializePageInjectionWithOptions(enterUnifiedPictureInPicture, options);
}

/** Creates the refresh unified picture in picture video script. */
export function createRefreshUnifiedPictureInPictureVideoScript(): string {
  return serializePageInjection(refreshUnifiedPictureInPictureVideo);
}

/** Creates the enter unified picture in picture host script. */
export function createEnterUnifiedPictureInPictureHostScript(
  childFrameUrl: string,
): string {
  return serializePageInjectionWithOptions(enterUnifiedPictureInPictureHost, {
    /** The child frame URL value. */
    childFrameUrl,
  });
}
