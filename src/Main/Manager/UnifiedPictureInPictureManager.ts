import {
  app,
  BrowserWindow,
  screen,
  type Display,
  type Input,
  type Rectangle,
  type WebContentsView,
  type WebFrameMain,
} from 'electron';
import { randomUUID } from 'node:crypto';
import type { PictureInPictureResult } from '../../Common/IPC';
import {
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
  PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM,
  resolvePictureInPictureSize,
  type PictureInPictureLastPlacement,
  type PictureInPicturePlacementPreference,
  type PictureInPictureSizePreference,
} from '../../Common/PictureInPicture';
import { attachRendererLogging } from '../Logging';
import { transferWebContentsView } from '../Functional/WebContentsViewTransfer';
import {
  disableMacOSFullScreenAuxiliary,
  enableMacOSFullScreenAuxiliary,
} from '../MacOSWindowSpaces';

const PIP_MARGIN = 20;
const PIP_HOVER_POLL_INTERVAL_MS = 80;
const PIP_VIDEO_DISCOVERY_RETRY_MS = 100;
const PIP_VIDEO_DISCOVERY_ATTEMPTS = 2;
const PIP_RETURN_BUTTON_BOUNDS = { x: 12, y: 12, width: 40, height: 40 };
const PIP_RESTORE_MESSAGE = `__kawaikara_pip_restore_${randomUUID()}`;
const PIP_PLAYBACK_BUTTON_SIZE = 54;
const PIP_NATIVE_DRAG_STYLE =
  process.platform === 'win32' ? '-webkit-app-region:drag;' : '';
const PIP_NATIVE_NO_DRAG_STYLE =
  process.platform === 'win32' ? '-webkit-app-region:no-drag;' : '';

const FIND_VIDEO_SCRIPT = `
  (() => {
    const videos = [];
    const visit = (root) => {
      root.querySelectorAll('video').forEach((video) => videos.push(video));
      root.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(document);
    if (videos.length === 0) return { status: 'no-video', score: 0 };

    const score = (video) => {
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
    videos.sort((left, right) => score(right) - score(left));
    const video = videos[0];
    return {
      status:
        video.readyState === HTMLMediaElement.HAVE_NOTHING || !video.videoWidth
          ? 'not-ready'
          : 'ready',
      score: score(video),
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  })();
`;

const ENTER_UNIFIED_PIP_SCRIPT = `
  (() => {
    const existing = window.__kawaikaraUnifiedPictureInPicture;
    if (existing) {
      return {
        status: 'entered',
        videoHeight: existing.video.videoHeight,
        videoWidth: existing.video.videoWidth,
      };
    }
    document.dispatchEvent(
      new Event('kawaikara:picture-in-picture-transition'),
    );

    const videos = [];
    const visit = (root) => {
      root.querySelectorAll('video').forEach((video) => videos.push(video));
      root.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(document);
    if (videos.length === 0) return { status: 'no-video' };

    const score = (video) => {
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
    videos.sort((left, right) => score(right) - score(left));
    const video = videos[0];
    if (video.readyState === HTMLMediaElement.HAVE_NOTHING || !video.videoWidth) {
      return { status: 'not-ready' };
    }

    const videoMarker = video.getAttribute('data-kawaikara-unified-pip-video');
    video.setAttribute('data-kawaikara-unified-pip-video', 'true');
    const elements = [];
    for (let element = video; element; element = element.parentElement) {
      elements.push({ element, style: element.getAttribute('style') });
    }
    const backdrop = document.createElement('div');
    backdrop.dataset.kawaikaraUnifiedPipBackdrop = 'true';
    backdrop.style.cssText = [
      'position:fixed!important',
      'inset:0!important',
      'width:100vw!important',
      'height:100vh!important',
      'background:#000!important',
      'z-index:2147483646!important',
      'pointer-events:none!important',
    ].join(';');
    document.body.append(backdrop);

    for (const { element } of elements) {
      element.style.setProperty('transform', 'none', 'important');
      element.style.setProperty('filter', 'none', 'important');
      element.style.setProperty('perspective', 'none', 'important');
      element.style.setProperty('contain', 'none', 'important');
      element.style.setProperty('clip-path', 'none', 'important');
      if (element === document.body || element === document.documentElement) {
        element.style.setProperty('overflow', 'hidden', 'important');
      }
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('z-index', '2147483647', 'important');
    }
    video.style.setProperty('position', 'fixed', 'important');
    video.style.setProperty('inset', '0', 'important');
    video.style.setProperty('width', '100vw', 'important');
    video.style.setProperty('height', '100vh', 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('max-height', 'none', 'important');
    video.style.setProperty('object-fit', 'contain', 'important');
    video.style.setProperty('background', '#000', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('z-index', '2147483647', 'important');

    const controlsStyle = document.createElement('style');
    controlsStyle.dataset.kawaikaraUnifiedPipControls = 'true';
    const controlsStyleText =
      'html,body{width:100%!important;height:100%!important;' +
        'overflow:hidden!important;overscroll-behavior:none!important}' +
      'html::-webkit-scrollbar,body::-webkit-scrollbar{' +
        'display:none!important;width:0!important;height:0!important}' +
      'body *{visibility:hidden!important;pointer-events:none!important}' +
      'body [data-kawaikara-unified-pip-backdrop="true"]{' +
        'visibility:visible!important;pointer-events:none!important}' +
      'body video[data-kawaikara-unified-pip-video="true"]{' +
        'position:fixed!important;inset:0!important;' +
        'width:100vw!important;height:100vh!important;' +
        'max-width:none!important;max-height:none!important;' +
        'object-fit:contain!important;background:#000!important;' +
        'visibility:visible!important;pointer-events:none!important;' +
        'z-index:2147483647!important}' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls,' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-enclosure,' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-panel,' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-timeline,' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-current-time-display,' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls-time-remaining-display' +
      '{display:none!important;opacity:0!important;visibility:hidden!important}';
    const navigationControlsStyleText =
      'body [data-kawaikara-unified-pip-backdrop="true"]{' +
        'visibility:visible!important;pointer-events:none!important}' +
      'body video[data-kawaikara-unified-pip-video="true"]{' +
        'position:fixed!important;inset:0!important;' +
        'width:100vw!important;height:100vh!important;' +
        'max-width:none!important;max-height:none!important;' +
        'object-fit:contain!important;background:#000!important;' +
        'visibility:visible!important;pointer-events:none!important;' +
        'z-index:2147483647!important}' +
      'video[data-kawaikara-unified-pip-video="true"]::-webkit-media-controls{' +
        'display:none!important;opacity:0!important;visibility:hidden!important}';
    controlsStyle.textContent = controlsStyleText;
    document.head.append(controlsStyle);

    const maintainNavigationVideoPosition = () => {
      const activeState = window.__kawaikaraUnifiedPictureInPicture;
      if (!activeState?.layoutReleased) return;
      const currentX = activeState.navigationOffsetX ?? 0;
      const currentY = activeState.navigationOffsetY ?? 0;
      const rect = activeState.video.getBoundingClientRect();
      const nextX = currentX - rect.left;
      const nextY = currentY - rect.top;
      activeState.navigationOffsetX = nextX;
      activeState.navigationOffsetY = nextY;
      activeState.video.style.setProperty(
        'transform',
        'translate(' + String(nextX) + 'px,' + String(nextY) + 'px)',
        'important',
      );
      requestAnimationFrame(maintainNavigationVideoPosition);
    };

    const restoreLayoutAfterNavigation = () => {
      const activeState = window.__kawaikaraUnifiedPictureInPicture;
      if (!activeState?.layoutReleased) return;
      const activeContainer = activeState.video.closest(
        '[is-active], [aria-current="true"], [class*="is_current"]',
      );
      if (
        !activeContainer &&
        (activeState.video.paused || activeState.video.ended)
      ) {
        return;
      }
      for (const { element, style } of activeState.elements) {
        if (style === null) element.removeAttribute('style');
        else element.setAttribute('style', style);
      }
      const elements = [];
      for (
        let element = activeState.video;
        element;
        element = element.parentElement
      ) {
        elements.push({ element, style: element.getAttribute('style') });
      }
      activeState.elements = elements;
      for (const { element } of elements) {
        element.style.setProperty('transform', 'none', 'important');
        element.style.setProperty('filter', 'none', 'important');
        element.style.setProperty('perspective', 'none', 'important');
        element.style.setProperty('contain', 'none', 'important');
        element.style.setProperty('clip-path', 'none', 'important');
        if (element === document.body || element === document.documentElement) {
          element.style.setProperty('overflow', 'hidden', 'important');
        }
        element.style.setProperty('opacity', '1', 'important');
        element.style.setProperty('z-index', '2147483647', 'important');
      }
      activeState.video.style.setProperty('position', 'fixed', 'important');
      activeState.video.style.setProperty('inset', '0', 'important');
      activeState.video.style.setProperty('width', '100vw', 'important');
      activeState.video.style.setProperty('height', '100vh', 'important');
      activeState.video.style.setProperty('max-width', 'none', 'important');
      activeState.video.style.setProperty('max-height', 'none', 'important');
      activeState.video.style.setProperty('object-fit', 'contain', 'important');
      activeState.video.style.setProperty('background', '#000', 'important');
      activeState.video.style.setProperty('visibility', 'visible', 'important');
      activeState.video.style.setProperty('z-index', '2147483647', 'important');
      activeState.controlsStyle.textContent = activeState.controlsStyleText;
      activeState.layoutReleased = false;
      activeState.navigationOffsetX = 0;
      activeState.navigationOffsetY = 0;
    };

    const releaseLayoutForNavigation = () => {
      const activeState = window.__kawaikaraUnifiedPictureInPicture;
      if (!activeState) return;
      // YouTube Shorts and CHZZK Clips both use an internal carousel. PiP must
      // temporarily restore that carousel's transforms/overflow before its
      // native next/previous command can select the new video element. The
      // black backdrop and the currently marked video remain above the page.
      for (const { element, style } of activeState.elements) {
        if (style === null) element.removeAttribute('style');
        else element.setAttribute('style', style);
      }
      activeState.controlsStyle.textContent =
        activeState.navigationControlsStyleText;
      activeState.layoutReleased = true;
      activeState.navigationOffsetX = 0;
      activeState.navigationOffsetY = 0;
      requestAnimationFrame(maintainNavigationVideoPosition);
    };

    const overlay = document.createElement('div');
    overlay.dataset.kawaikaraUnifiedPipOverlay = 'true';
    overlay.style.cssText = [
      'all:initial!important',
      'position:fixed!important',
      'inset:0!important',
      'display:block!important',
      'z-index:2147483647!important',
      'pointer-events:auto!important',
    ].join(';');
    const shadow = overlay.attachShadow({ mode: 'closed' });
    const overlayStyle = document.createElement('style');
    overlayStyle.textContent =
      ':host{all:initial}' +
      '.drag-surface{' +
        'position:absolute;inset:0;cursor:move;' +
        ${JSON.stringify(PIP_NATIVE_DRAG_STYLE)} +
      '}' +
      'button{' +
        'position:absolute;' +
        'width:40px;height:40px;padding:0;border:1px solid rgba(255,255,255,.2);' +
        'border-radius:12px;background:rgba(12,12,14,.82);color:#fff;' +
        'z-index:1;display:grid;place-items:center;cursor:pointer;' +
        'opacity:0;transform:scale(.92);pointer-events:none;' +
        'transition:opacity 140ms ease,transform 140ms ease,background 140ms ease;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(12px);' +
        ${JSON.stringify(PIP_NATIVE_NO_DRAG_STYLE)} +
      '}' +
      '.restore-button{top:12px;left:12px}' +
      '.playback-button{' +
        'top:50%;left:50%;width:${String(PIP_PLAYBACK_BUTTON_SIZE)}px;' +
        'height:${String(PIP_PLAYBACK_BUTTON_SIZE)}px;border-radius:50%;' +
        'transform:translate(-50%,-50%) scale(.92);background:rgba(12,12,14,.72)' +
      '}' +
      ':host([data-controls-visible="true"]) button,' +
      'button:hover,' +
      'button:focus-visible{' +
        'opacity:1;transform:scale(1);pointer-events:auto' +
      '}' +
      ':host([data-controls-visible="true"]) .playback-button,' +
      '.playback-button:hover,' +
      '.playback-button:focus-visible{' +
        'transform:translate(-50%,-50%) scale(1)' +
      '}' +
      'button:hover{background:rgba(38,38,43,.96)}' +
      'svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;' +
        'stroke-linecap:round;stroke-linejoin:round}';
    const dragSurface = document.createElement('div');
    dragSurface.className = 'drag-surface';
    dragSurface.setAttribute('aria-hidden', 'true');
    const restoreButton = document.createElement('button');
    restoreButton.className = 'restore-button';
    restoreButton.type = 'button';
    restoreButton.title = 'Return to Kawaikara';
    restoreButton.setAttribute('aria-label', 'Return to Kawaikara');
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const restoreIcon = document.createElementNS(svgNamespace, 'svg');
    restoreIcon.setAttribute('viewBox', '0 0 24 24');
    restoreIcon.setAttribute('aria-hidden', 'true');
    for (const pathData of [
      'M9 5H5v14h14v-4',
      'M11 5h8v8',
      'm19 5-9 9',
    ]) {
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('d', pathData);
      restoreIcon.append(path);
    }
    restoreButton.append(restoreIcon);
    const playbackButton = document.createElement('button');
    playbackButton.className = 'playback-button';
    playbackButton.type = 'button';
    const activePlaybackVideo = () =>
      window.__kawaikaraUnifiedPictureInPicture?.video ?? video;
    const renderPlaybackButton = () => {
      const activeVideo = activePlaybackVideo();
      const paused = activeVideo.paused || activeVideo.ended;
      playbackButton.title = paused ? 'Play' : 'Pause';
      playbackButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
      const icon = document.createElementNS(svgNamespace, 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('d', paused ? 'M8 5v14l11-7z' : 'M9 5v14M15 5v14');
      icon.append(path);
      playbackButton.replaceChildren(icon);
    };
    const togglePlayback = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const activeVideo = activePlaybackVideo();
      if (activeVideo.paused || activeVideo.ended) {
        if (activeVideo.ended) activeVideo.currentTime = 0;
        void activeVideo.play().catch(() => undefined);
      } else {
        activeVideo.pause();
      }
      renderPlaybackButton();
    };
    playbackButton.addEventListener('click', togglePlayback);
    video.addEventListener('play', renderPlaybackButton);
    video.addEventListener('pause', renderPlaybackButton);
    video.addEventListener('ended', renderPlaybackButton);
    renderPlaybackButton();
    shadow.append(overlayStyle, dragSurface, restoreButton, playbackButton);
    restoreButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.debug(${JSON.stringify(PIP_RESTORE_MESSAGE)});
    });
    document.documentElement.append(overlay);

    window.__kawaikaraUnifiedPictureInPicture = {
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
      video,
      videoMarker,
    };
    video.controls = false;
    return {
      status: 'entered',
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  })();
`;

const EXIT_UNIFIED_PIP_SCRIPT = `
  (async () => {
    const state = window.__kawaikaraUnifiedPictureInPicture;
    if (!state) return { status: 'exited' };
    document.dispatchEvent(
      new Event('kawaikara:picture-in-picture-transition'),
    );
    state.video.controls = state.controls;
    state.video.removeEventListener('play', state.renderPlaybackButton);
    state.video.removeEventListener('pause', state.renderPlaybackButton);
    state.video.removeEventListener('ended', state.renderPlaybackButton);
    for (const { element, style } of state.elements) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    state.controlsStyle.remove();
    state.overlay.remove();
    state.backdrop.remove();
    if (state.videoMarker === null) {
      state.video.removeAttribute('data-kawaikara-unified-pip-video');
    } else {
      state.video.setAttribute(
        'data-kawaikara-unified-pip-video',
        state.videoMarker,
      );
    }
    delete window.__kawaikaraUnifiedPictureInPicture;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    return { status: 'exited' };
  })();
`;

const REFRESH_UNIFIED_PIP_VIDEO_SCRIPT = `
  (() => {
    const state = window.__kawaikaraUnifiedPictureInPicture;
    if (!state) return { status: 'missing' };

    const videos = [];
    const visit = (root) => {
      root.querySelectorAll('video').forEach((video) => videos.push(video));
      root.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(document);
    const score = (video) => {
      const rect = video.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
      );
      const activeContainer = video.closest(
        '[is-active], [aria-current="true"], [class*="is_current"]',
      );
      return (
        (activeContainer ? 1e18 : 0) +
        (!video.paused && !video.ended ? 1e15 : 0) +
        (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
        visibleWidth * visibleHeight
      );
    };
    videos.sort((left, right) => score(right) - score(left));
    const video = videos[0];
    if (
      !video ||
      video.readyState === HTMLMediaElement.HAVE_NOTHING ||
      !video.videoWidth
    ) {
      return { status: 'not-ready' };
    }
    if (video === state.video && !state.layoutReleased) {
      return { status: 'unchanged' };
    }

    state.video.controls = state.controls;
    state.video.removeEventListener('play', state.renderPlaybackButton);
    state.video.removeEventListener('pause', state.renderPlaybackButton);
    state.video.removeEventListener('ended', state.renderPlaybackButton);
    for (const { element, style } of state.elements) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    if (state.videoMarker === null) {
      state.video.removeAttribute('data-kawaikara-unified-pip-video');
    } else {
      state.video.setAttribute(
        'data-kawaikara-unified-pip-video',
        state.videoMarker,
      );
    }

    const videoMarker = video.getAttribute('data-kawaikara-unified-pip-video');
    video.setAttribute('data-kawaikara-unified-pip-video', 'true');
    const elements = [];
    for (let element = video; element; element = element.parentElement) {
      elements.push({ element, style: element.getAttribute('style') });
    }
    for (const { element } of elements) {
      element.style.setProperty('transform', 'none', 'important');
      element.style.setProperty('filter', 'none', 'important');
      element.style.setProperty('perspective', 'none', 'important');
      element.style.setProperty('contain', 'none', 'important');
      element.style.setProperty('clip-path', 'none', 'important');
      if (element === document.body || element === document.documentElement) {
        element.style.setProperty('overflow', 'hidden', 'important');
      }
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('z-index', '2147483647', 'important');
    }
    video.style.setProperty('position', 'fixed', 'important');
    video.style.setProperty('inset', '0', 'important');
    video.style.setProperty('width', '100vw', 'important');
    video.style.setProperty('height', '100vh', 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('max-height', 'none', 'important');
    video.style.setProperty('object-fit', 'contain', 'important');
    video.style.setProperty('background', '#000', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('z-index', '2147483647', 'important');

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
      status: 'refreshed',
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  })();
`;

const EXIT_UNIFIED_PIP_HOST_SCRIPT = `
  (() => {
    const state = window.__kawaikaraUnifiedPictureInPictureHost;
    if (!state) return { status: 'exited' };
    for (const { element, marker, style } of state.elements) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
      if (marker === null) {
        element.removeAttribute('data-kawaikara-unified-pip-host-path');
      } else {
        element.setAttribute('data-kawaikara-unified-pip-host-path', marker);
      }
    }
    state.style.remove();
    delete window.__kawaikaraUnifiedPictureInPictureHost;
    return { status: 'exited' };
  })();
`;

function createEnterUnifiedPipHostScript(childFrameUrl: string): string {
  return `
    (() => {
      if (window.__kawaikaraUnifiedPictureInPictureHost) {
        return { status: 'entered' };
      }
      const childFrameUrl = ${JSON.stringify(childFrameUrl)};
      const desiredUrl = new URL(childFrameUrl);
      const candidates = [...document.querySelectorAll('iframe')].filter((frame) => {
        try {
          const frameUrl = new URL(frame.src, location.href);
          return (
            frameUrl.origin === desiredUrl.origin &&
            frameUrl.pathname === desiredUrl.pathname
          );
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
      if (!target) return { status: 'no-frame' };

      const elements = [];
      for (let element = target; element; element = element.parentElement) {
        elements.push({
          element,
          marker: element.getAttribute('data-kawaikara-unified-pip-host-path'),
          style: element.getAttribute('style'),
        });
        element.setAttribute('data-kawaikara-unified-pip-host-path', 'true');
        element.style.setProperty('transform', 'none', 'important');
        element.style.setProperty('filter', 'none', 'important');
        element.style.setProperty('perspective', 'none', 'important');
        element.style.setProperty('contain', 'none', 'important');
        element.style.setProperty('clip-path', 'none', 'important');
        element.style.setProperty('overflow', 'visible', 'important');
        element.style.setProperty('opacity', '1', 'important');
        element.style.setProperty('visibility', 'visible', 'important');
        element.style.setProperty('z-index', '2147483647', 'important');
      }
      target.style.setProperty('position', 'fixed', 'important');
      target.style.setProperty('inset', '0', 'important');
      target.style.setProperty('width', '100vw', 'important');
      target.style.setProperty('height', '100vh', 'important');
      target.style.setProperty('max-width', 'none', 'important');
      target.style.setProperty('max-height', 'none', 'important');
      target.style.setProperty('border', '0', 'important');
      target.style.setProperty('background', '#000', 'important');

      const style = document.createElement('style');
      style.dataset.kawaikaraUnifiedPipHost = 'true';
      style.textContent =
        'html,body{width:100%!important;height:100%!important;' +
          'overflow:hidden!important;background:#000!important}' +
        'body *{visibility:hidden!important;pointer-events:none!important}' +
        'body [data-kawaikara-unified-pip-host-path="true"]{' +
          'visibility:visible!important}' +
        'body iframe[data-kawaikara-unified-pip-host-path="true"]{' +
          'pointer-events:auto!important}';
      document.head.append(style);
      window.__kawaikaraUnifiedPictureInPictureHost = { elements, style };
      return { status: 'entered' };
    })();
  `;
}

interface VideoCandidate {
  readonly aspectRatio?: number;
  readonly frame: WebFrameMain;
  readonly score: number;
  readonly status: 'ready' | 'not-ready';
}

interface UnifiedPictureInPictureState {
  closing: boolean;
  controlsVisible: boolean;
  dragState?: {
    readonly cursorX: number;
    readonly cursorY: number;
    readonly windowX: number;
    readonly windowY: number;
  };
  readonly consoleListener: (
    details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
  ) => void;
  frame: WebFrameMain;
  readonly inputListener: (event: Electron.Event, input: Input) => void;
  hostFrames: readonly WebFrameMain[];
  readonly mediaStartedListener: () => void;
  readonly pointerInputListener: (
    event: Electron.Event,
    input: Electron.InputEvent,
  ) => void;
  readonly pipWindow: BrowserWindow;
  readonly siteView: WebContentsView;
  readonly viewerWindow: BrowserWindow;
  readonly fullscreenReassertTimers: Set<ReturnType<typeof setTimeout>>;
  readonly videoRefreshTimers: Set<ReturnType<typeof setTimeout>>;
  refreshingVideo: boolean;
  hoverTimer?: ReturnType<typeof setInterval>;
}

export class UnifiedPictureInPictureManager {
  private enterPromise?: Promise<PictureInPictureResult>;
  private exitPromise?: Promise<PictureInPictureResult>;
  private state?: UnifiedPictureInPictureState;
  private placementPreference = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  private placementWrite = Promise.resolve();
  private portraitSizePreference = DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
  private sizePreference = DEFAULT_PICTURE_IN_PICTURE_SIZE;

  constructor(
    private readonly getViewerWindow: () => BrowserWindow,
    private readonly getSiteView: () => WebContentsView,
    private readonly onStateChanged: (result: PictureInPictureResult) => void,
    private readonly onExited: () => void,
    private readonly onLastPlacementChanged?: (
      placement: PictureInPictureLastPlacement,
    ) => Promise<void> | void,
  ) {}

  setWindowSize(preference: PictureInPictureSizePreference): void {
    this.sizePreference = preference;
  }

  setPortraitWindowSize(preference: PictureInPictureSizePreference): void {
    this.portraitSizePreference = preference;
  }

  setWindowPlacement(preference: PictureInPicturePlacementPreference): void {
    this.placementPreference = preference;
  }

  isActive(): boolean {
    return this.state !== undefined;
  }

  toggle(): Promise<PictureInPictureResult> {
    if (this.exitPromise) return this.exitPromise;
    if (this.state) return this.exit();
    if (this.enterPromise) return this.enterPromise;

    const operation = this.enter();
    this.enterPromise = operation;
    const clear = () => {
      if (this.enterPromise === operation) this.enterPromise = undefined;
    };
    void operation.then(clear, clear);
    return operation;
  }

  async exitAllModes(): Promise<void> {
    if (this.enterPromise) await this.enterPromise;
    if (this.state) await this.exit();
    await this.placementWrite;
  }

  handleViewerClosed(): void {
    const state = this.state;
    this.state = undefined;
    if (!state) return;
    state.closing = true;
    this.stopHoverTracking(state);
    this.clearFullscreenReassertions(state);
    this.clearVideoRefreshes(state);
    state.siteView.webContents.off('console-message', state.consoleListener);
    state.siteView.webContents.off('before-input-event', state.inputListener);
    state.siteView.webContents.off('input-event', state.pointerInputListener);
    state.siteView.webContents.off(
      'media-started-playing',
      state.mediaStartedListener,
    );
    void this.restoreHostFrames(state.hostFrames);
    void this.restoreMacApplicationPresentation(state.pipWindow);
    if (!state.pipWindow.isDestroyed()) state.pipWindow.destroy();
  }

  private async enter(): Promise<PictureInPictureResult> {
    const viewerWindow = this.getViewerWindow();
    const siteView = this.getSiteView();
    const candidate = await this.findVideoCandidate(siteView);
    if (!candidate) return withWindowMode('no-video');
    if (candidate.status === 'not-ready') return withWindowMode('not-ready');

    let pipWindow: BrowserWindow | undefined;
    let hostFrames: readonly WebFrameMain[] = [];
    try {
      hostFrames = await this.enterHostFrames(candidate.frame);
      const result = parseEnterResult(
        await candidate.frame.executeJavaScript(
          ENTER_UNIFIED_PIP_SCRIPT,
          true,
        ),
      );
      if (result.status !== 'entered') return withWindowMode(result.status);

      const bounds = this.resolveInitialBounds(
        viewerWindow,
        result.aspectRatio ?? candidate.aspectRatio,
      );
      pipWindow = this.createPipWindow(bounds, result.aspectRatio);

      const inputListener = (event: Electron.Event, input: Input): void => {
        if (
          input.type === 'keyDown' &&
          input.key.toLowerCase() === 'tab'
        ) {
          event.preventDefault();
          return;
        }
        if (
          input.type === 'keyDown' &&
          !input.isAutoRepeat &&
          !input.isComposing &&
          !input.control &&
          !input.meta &&
          !input.alt &&
          !input.shift &&
          input.key.toLowerCase() === 'escape'
        ) {
          event.preventDefault();
          void this.exit();
        }
      };
      const consoleListener = (
        details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
      ): void => {
        if (details.message !== PIP_RESTORE_MESSAGE) return;
        void this.exit();
      };
      const pointerInputListener = (
        _event: Electron.Event,
        input: Electron.InputEvent,
      ): void => {
        const activeState = this.state;
        if (!activeState || activeState.pipWindow !== pipWindow) return;
        this.handlePointerInput(activeState, input);
      };
      const mediaStartedListener = (): void => {
        const activeState = this.state;
        if (!activeState || activeState.pipWindow !== pipWindow) return;
        this.scheduleVideoRefresh(activeState);
      };
      const state: UnifiedPictureInPictureState = {
        closing: false,
        consoleListener,
        controlsVisible: false,
        frame: candidate.frame,
        fullscreenReassertTimers: new Set(),
        hostFrames,
        inputListener,
        mediaStartedListener,
        pipWindow,
        pointerInputListener,
        siteView,
        videoRefreshTimers: new Set(),
        refreshingVideo: false,
        viewerWindow,
      };
      this.state = state;
      this.attachWindowEvents(state);
      siteView.webContents.on('console-message', consoleListener);
      siteView.webContents.on('before-input-event', inputListener);
      siteView.webContents.on('input-event', pointerInputListener);
      siteView.webContents.on('media-started-playing', mediaStartedListener);

      await transferWebContentsView({
        sourceWindow: viewerWindow,
        targetWindow: pipWindow,
        view: siteView,
      });
      viewerWindow.hide();
      if (process.platform === 'darwin') {
        // Match Chatty's overlay presentation: do not activate Kawaikara or
        // steal focus from the fullscreen game. The screen-saver window level
        // is reapplied after the view transfer, immediately before ordering.
        this.presentMacPictureInPicture(pipWindow);
      } else {
        pipWindow.show();
        pipWindow.focus();
        siteView.webContents.focus();
      }
      this.startHoverTracking(state);
      this.scheduleFullscreenReassertion(state);

      const entered = withWindowMode('entered');
      this.onStateChanged(entered);
      return entered;
    } catch (error) {
      console.error('Unified PiP could not be started.', error);
      const state = this.state;
      this.state = undefined;
      if (state) {
        state.closing = true;
        this.stopHoverTracking(state);
        this.clearFullscreenReassertions(state);
        this.clearVideoRefreshes(state);
        state.siteView.webContents.off(
          'console-message',
          state.consoleListener,
        );
        state.siteView.webContents.off(
          'before-input-event',
          state.inputListener,
        );
        state.siteView.webContents.off(
          'input-event',
          state.pointerInputListener,
        );
        state.siteView.webContents.off(
          'media-started-playing',
          state.mediaStartedListener,
        );
      }
      await this.restoreInjectedVideo(candidate.frame);
      await this.restoreHostFrames(hostFrames);
      await this.restoreSiteView(viewerWindow, siteView, pipWindow);
      await this.restoreMacApplicationPresentation(pipWindow);
      if (pipWindow && !pipWindow.isDestroyed()) pipWindow.destroy();
      viewerWindow.show();
      return withWindowMode('failed');
    }
  }

  private exit(): Promise<PictureInPictureResult> {
    if (this.exitPromise) return this.exitPromise;
    const operation = this.performExit();
    this.exitPromise = operation;
    const clear = () => {
      if (this.exitPromise === operation) this.exitPromise = undefined;
    };
    void operation.then(clear, clear);
    return operation;
  }

  private async performExit(): Promise<PictureInPictureResult> {
    const state = this.state;
    if (!state) return withWindowMode('exited');
    state.closing = true;
    this.stopHoverTracking(state);
    this.clearFullscreenReassertions(state);
    this.clearVideoRefreshes(state);
    state.siteView.webContents.off('console-message', state.consoleListener);
    state.siteView.webContents.off('before-input-event', state.inputListener);
    state.siteView.webContents.off('input-event', state.pointerInputListener);
    state.siteView.webContents.off(
      'media-started-playing',
      state.mediaStartedListener,
    );

    await this.rememberCurrentPlacement(state.pipWindow);
    await this.restoreInjectedVideo(state.frame);
    await this.restoreHostFrames(state.hostFrames);
    await this.restoreSiteView(
      state.viewerWindow,
      state.siteView,
      state.pipWindow,
    );
    this.state = undefined;
    if (!state.pipWindow.isDestroyed()) state.pipWindow.hide();
    await this.restoreMacApplicationPresentation(state.pipWindow);
    if (!state.viewerWindow.isDestroyed()) state.viewerWindow.show();
    if (!state.pipWindow.isDestroyed()) state.pipWindow.destroy();

    const exited = withWindowMode('exited');
    this.onStateChanged(exited);
    this.onExited();
    return exited;
  }

  private createPipWindow(
    bounds: Rectangle,
    aspectRatio?: number,
  ): BrowserWindow {
    if (process.platform === 'darwin') {
      this.prepareMacApplicationForPictureInPicture();
    }
    const pipWindow = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      title: 'Kawaikara PiP',
      backgroundColor: '#000000',
      alwaysOnTop: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: process.platform !== 'darwin',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    attachRendererLogging(pipWindow.webContents, 'picture-in-picture');
    pipWindow.setMenu(null);
    pipWindow.setMenuBarVisibility(false);
    pipWindow.setMinimumSize(
      PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width,
      PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height,
    );
    if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
      pipWindow.setAspectRatio(aspectRatio);
    }
    if (process.platform === 'darwin') {
      this.applyMacPictureInPictureLevel(pipWindow);
    } else {
      pipWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    return pipWindow;
  }

  private applyMacPictureInPictureLevel(pipWindow: BrowserWindow): void {
    // Electron's public call sets the all-workspaces behavior, but an app that
    // started as a regular Dock app can still omit an already-existing true
    // fullscreen Space. Apply AppKit's FullScreenAuxiliary bit directly after
    // Electron has finished changing the window collection behavior.
    pipWindow.setAlwaysOnTop(true, 'screen-saver');
    pipWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    enableMacOSFullScreenAuxiliary(pipWindow);
  }

  private prepareMacApplicationForPictureInPicture(): void {
    // FullScreenAuxiliary windows must belong to an accessory/UI-element app.
    // Kawaikara returns to a regular Dock app as soon as PiP exits.
    app.setActivationPolicy('accessory');
    app.dock?.hide();
  }

  private presentMacPictureInPicture(pipWindow: BrowserWindow): void {
    this.prepareMacApplicationForPictureInPicture();
    this.applyMacPictureInPictureLevel(pipWindow);
    pipWindow.showInactive();
    pipWindow.moveTop();
  }

  private attachWindowEvents(state: UnifiedPictureInPictureState): void {
    state.pipWindow.on('resize', () => this.syncSiteViewBounds(state));
    state.pipWindow.on('blur', () => {
      this.scheduleFullscreenReassertion(state);
    });
    state.pipWindow.on('close', (event) => {
      if (state.closing || this.state !== state) return;
      event.preventDefault();
      void this.exit();
    });
    state.pipWindow.on('closed', () => {
      if (state.closing || this.state !== state) return;
      void this.exit();
    });
    state.pipWindow.webContents.on('before-input-event', state.inputListener);
  }

  private syncSiteViewBounds(state: UnifiedPictureInPictureState): void {
    if (state.pipWindow.isDestroyed()) return;
    const [width, height] = state.pipWindow.getContentSize();
    state.siteView.setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  private handlePointerInput(
    state: UnifiedPictureInPictureState,
    input: Electron.InputEvent,
  ): void {
    if (state.closing || state.pipWindow.isDestroyed()) return;
    if (
      input.type !== 'mouseDown' &&
      input.type !== 'mouseMove' &&
      input.type !== 'mouseUp' &&
      input.type !== 'mouseLeave'
    ) {
      return;
    }

    const mouseInput = input as Electron.MouseInputEvent;
    if (process.platform === 'win32') {
      // Crossing between a native draggable region and a no-drag button can
      // emit a transient mouseLeave on Windows. The screen-coordinate poll is
      // authoritative for hiding; input events only reveal controls eagerly.
      if (input.type !== 'mouseLeave') this.setControlsVisible(state, true);
      return;
    }

    if (input.type === 'mouseDown') {
      if (mouseInput.button && mouseInput.button !== 'left') return;
      if (isPointInside(mouseInput, PIP_RETURN_BUTTON_BOUNDS)) return;
      const [contentWidth, contentHeight] = state.pipWindow.getContentSize();
      if (
        isPointInside(mouseInput, {
          x: (contentWidth - PIP_PLAYBACK_BUTTON_SIZE) / 2,
          y: (contentHeight - PIP_PLAYBACK_BUTTON_SIZE) / 2,
          width: PIP_PLAYBACK_BUTTON_SIZE,
          height: PIP_PLAYBACK_BUTTON_SIZE,
        })
      ) {
        return;
      }
      const cursor = resolveGlobalMousePoint(mouseInput);
      const [windowX, windowY] = state.pipWindow.getPosition();
      state.dragState = {
        cursorX: cursor.x,
        cursorY: cursor.y,
        windowX,
        windowY,
      };
      return;
    }

    if (input.type === 'mouseUp' || input.type === 'mouseLeave') {
      state.dragState = undefined;
      return;
    }

    const drag = state.dragState;
    if (!drag) return;
    const cursor = resolveGlobalMousePoint(mouseInput);
    state.pipWindow.setPosition(
      Math.round(drag.windowX + cursor.x - drag.cursorX),
      Math.round(drag.windowY + cursor.y - drag.cursorY),
      false,
    );
  }

  private startHoverTracking(state: UnifiedPictureInPictureState): void {
    // Native draggable regions do not reliably emit WebContents mouse-move
    // events on Windows. Screen coordinates make the whole PiP surface a
    // dependable hover target on every platform.
    const sync = () => {
      if (this.state !== state || state.pipWindow.isDestroyed()) return;
      const point = screen.getCursorScreenPoint();
      const bounds = state.pipWindow.getBounds();
      this.setControlsVisible(
        state,
        point.x >= bounds.x &&
          point.x < bounds.x + bounds.width &&
          point.y >= bounds.y &&
          point.y < bounds.y + bounds.height,
      );
    };
    sync();
    state.hoverTimer = setInterval(sync, PIP_HOVER_POLL_INTERVAL_MS);
  }

  private stopHoverTracking(state: UnifiedPictureInPictureState): void {
    if (state.hoverTimer === undefined) return;
    clearInterval(state.hoverTimer);
    state.hoverTimer = undefined;
  }

  private scheduleFullscreenReassertion(
    state: UnifiedPictureInPictureState,
  ): void {
    if (process.platform !== 'darwin') return;
    this.clearFullscreenReassertions(state);
    for (const delayMilliseconds of [0, 250, 1_000]) {
      const timer = setTimeout(() => {
        state.fullscreenReassertTimers.delete(timer);
        if (
          this.state !== state ||
          state.closing ||
          state.pipWindow.isDestroyed()
        ) {
          return;
        }
        // Reapply the full Chatty sequence after macOS moves focus/Spaces.
        this.presentMacPictureInPicture(state.pipWindow);
      }, delayMilliseconds);
      state.fullscreenReassertTimers.add(timer);
    }
  }

  private clearFullscreenReassertions(
    state: UnifiedPictureInPictureState,
  ): void {
    for (const timer of state.fullscreenReassertTimers) clearTimeout(timer);
    state.fullscreenReassertTimers.clear();
  }

  private scheduleVideoRefresh(state: UnifiedPictureInPictureState): void {
    // Short-form players begin playback before their vertical carousel has
    // settled. Refreshing immediately freezes that intermediate offset into
    // the PiP layout, so wait until the native transition is complete.
    for (const delayMilliseconds of [620, 980]) {
      const timer = setTimeout(() => {
        state.videoRefreshTimers.delete(timer);
        if (this.state !== state || state.closing) {
          return;
        }
        void this.refreshActiveVideo(state);
      }, delayMilliseconds);
      state.videoRefreshTimers.add(timer);
    }
  }

  private async refreshActiveVideo(
    state: UnifiedPictureInPictureState,
  ): Promise<void> {
    if (state.refreshingVideo || this.state !== state || state.closing) return;
    state.refreshingVideo = true;
    try {
      const candidate = await this.inspectVideoFrames(state.siteView);
      if (
        !candidate ||
        candidate.status !== 'ready' ||
        this.state !== state ||
        state.closing
      ) {
        return;
      }

      if (candidate.frame === state.frame && !state.frame.isDestroyed()) {
        await state.frame.executeJavaScript(REFRESH_UNIFIED_PIP_VIDEO_SCRIPT, true);
        return;
      }

      // CHZZK Clips can replace its m.naver.com player iframe while moving
      // between clips. Rebuild both the host-frame path and the in-page PiP
      // controls in the newly active frame; keeping the original WebFrameMain
      // here leaves old audio alive and loses the restore overlay.
      const previousFrame = state.frame;
      const previousHostFrames = state.hostFrames;
      await this.restoreHostFrames(previousHostFrames);
      const nextHostFrames = await this.enterHostFrames(candidate.frame);
      const result = parseEnterResult(
        await candidate.frame.executeJavaScript(ENTER_UNIFIED_PIP_SCRIPT, true),
      );
      if (result.status !== 'entered') {
        await this.restoreHostFrames(nextHostFrames);
        if (!previousFrame.isDestroyed()) {
          state.hostFrames = await this.enterHostFrames(previousFrame);
        }
        return;
      }
      state.frame = candidate.frame;
      state.hostFrames = nextHostFrames;
      if (!previousFrame.isDestroyed()) {
        await previousFrame.executeJavaScript(
          "document.querySelectorAll('video').forEach((video) => video.pause())",
          true,
        ).catch(() => undefined);
      }
      await this.restoreInjectedVideo(previousFrame);
    } catch (error) {
      if (this.state === state && !state.closing) {
        console.debug('Unified PiP could not refresh its active video.', error);
      }
    } finally {
      state.refreshingVideo = false;
    }
  }

  private clearVideoRefreshes(state: UnifiedPictureInPictureState): void {
    for (const timer of state.videoRefreshTimers) clearTimeout(timer);
    state.videoRefreshTimers.clear();
  }

  private async restoreMacApplicationPresentation(
    pipWindow?: BrowserWindow,
  ): Promise<void> {
    if (process.platform !== 'darwin') return;
    try {
      if (pipWindow && !pipWindow.isDestroyed()) {
        disableMacOSFullScreenAuxiliary(pipWindow);
        // This reverses Electron's fullscreen-space process transformation.
        pipWindow.setVisibleOnAllWorkspaces(false, {
          visibleOnFullScreen: false,
        });
      }
      app.setActivationPolicy('regular');
      await app.dock?.show();
    } catch (error) {
      console.warn('Kawaikara could not restore its macOS Dock state.', error);
    }
  }

  private setControlsVisible(
    state: UnifiedPictureInPictureState,
    visible: boolean,
  ): void {
    if (state.controlsVisible === visible || state.frame.isDestroyed()) return;
    state.controlsVisible = visible;
    void state.frame
      .executeJavaScript(`
        (() => {
          const overlay = document.querySelector(
            '[data-kawaikara-unified-pip-overlay="true"]',
          );
          if (overlay) overlay.dataset.controlsVisible = ${JSON.stringify(visible)};
        })();
      `)
      .catch((error: unknown) => {
        if (this.state === state && !state.closing) {
          console.debug('Unified PiP hover state could not be updated.', error);
        }
      });
  }

  private restoreSiteView(
    viewerWindow: BrowserWindow,
    siteView: WebContentsView,
    sourceWindow?: BrowserWindow,
  ): Promise<void> {
    if (viewerWindow.isDestroyed() || siteView.webContents.isDestroyed()) {
      return Promise.resolve();
    }
    return transferWebContentsView({
      sourceWindow,
      targetWindow: viewerWindow,
      view: siteView,
    });
  }

  private async findVideoCandidate(
    siteView: WebContentsView,
  ): Promise<VideoCandidate | undefined> {
    let candidate: VideoCandidate | undefined;
    for (let attempt = 0; attempt < PIP_VIDEO_DISCOVERY_ATTEMPTS; attempt += 1) {
      candidate = await this.inspectVideoFrames(siteView);
      if (candidate?.status === 'ready') return candidate;
      if (attempt + 1 < PIP_VIDEO_DISCOVERY_ATTEMPTS) {
        await delay(PIP_VIDEO_DISCOVERY_RETRY_MS);
      }
    }
    return candidate;
  }

  private async inspectVideoFrames(
    siteView: WebContentsView,
  ): Promise<VideoCandidate | undefined> {
    let best: VideoCandidate | undefined;
    const frames = siteView.webContents.mainFrame.framesInSubtree.filter(
      (frame) => !frame.isDestroyed() && isInspectableFrameUrl(frame.url),
    );
    const candidates = await Promise.all(
      frames.map(async (frame): Promise<VideoCandidate | undefined> => {
        try {
          const result = parseVideoCandidate(
            await frame.executeJavaScript(FIND_VIDEO_SCRIPT),
          );
          return result ? { frame, ...result } : undefined;
        } catch (error) {
          console.debug(`Unified PiP could not inspect frame ${frame.url}.`, error);
          return undefined;
        }
      }),
    );
    for (const candidate of candidates) {
      if (!candidate || (best && candidate.score <= best.score)) continue;
      best = candidate;
    }
    return best;
  }

  private resolveInitialBounds(
    viewerWindow: BrowserWindow,
    aspectRatio?: number,
  ): Rectangle {
    const display = resolvePlacementDisplay(
      viewerWindow.getBounds(),
      this.placementPreference,
    );
    const portrait = typeof aspectRatio === 'number' && aspectRatio < 1;
    const preferredSize = resolvePictureInPictureSize(
      portrait ? this.portraitSizePreference : this.sizePreference,
      aspectRatio,
      portrait ? 'portrait' : 'landscape',
    );
    const size = fitSizeWithinWorkArea(
      {
        width: preferredSize.width,
        height: preferredSize.height,
      },
      display.workArea,
    );
    return resolvePlacementBounds(
      display.workArea,
      size.width,
      size.height,
      this.placementPreference,
    );
  }

  private async rememberCurrentPlacement(pipWindow: BrowserWindow): Promise<void> {
    if (pipWindow.isDestroyed() || !this.onLastPlacementChanged) return;
    const placement = captureLastPlacement(pipWindow);
    this.placementWrite = this.placementWrite
      .then(() => this.onLastPlacementChanged?.(placement))
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn('The last unified PiP position could not be saved.', error);
      });
    await this.placementWrite;
  }

  private async restoreInjectedVideo(frame: WebFrameMain): Promise<void> {
    if (frame.isDestroyed()) return;
    await frame.executeJavaScript(EXIT_UNIFIED_PIP_SCRIPT).catch((error: unknown) => {
      console.debug('Unified PiP video styles were already unavailable.', error);
    });
  }

  private async enterHostFrames(
    videoFrame: WebFrameMain,
  ): Promise<readonly WebFrameMain[]> {
    const entered: WebFrameMain[] = [];
    let child = videoFrame;
    let parent = child.parent;
    try {
      while (parent) {
        if (parent.isDestroyed() || child.isDestroyed()) {
          throw new Error('A PiP frame was destroyed during host preparation.');
        }
        const result = await parent.executeJavaScript(
          createEnterUnifiedPipHostScript(child.url),
          true,
        ) as { status?: unknown };
        if (result?.status !== 'entered') {
          throw new Error(
            `Could not expose embedded PiP frame (${String(result?.status)}).`,
          );
        }
        entered.push(parent);
        child = parent;
        parent = child.parent;
      }
      return entered;
    } catch (error) {
      await this.restoreHostFrames(entered);
      throw error;
    }
  }

  private async restoreHostFrames(
    frames: readonly WebFrameMain[],
  ): Promise<void> {
    await Promise.allSettled(
      [...frames].reverse().map((frame) =>
        frame.isDestroyed()
          ? Promise.resolve()
          : frame.executeJavaScript(EXIT_UNIFIED_PIP_HOST_SCRIPT),
      ),
    );
  }
}

function resolvePlacementDisplay(
  viewerBounds: Rectangle,
  preference: PictureInPicturePlacementPreference,
): Display {
  const displays = screen.getAllDisplays();
  const byId = (displayId: string | undefined) =>
    displayId
      ? displays.find((display) => String(display.id) === displayId)
      : undefined;
  const currentDisplay = screen.getDisplayMatching(viewerBounds);
  switch (preference.monitor.mode) {
    case 'display':
      return byId(preference.monitor.displayId) ?? currentDisplay;
    case 'last':
      return byId(preference.lastPlacement?.displayId) ?? currentDisplay;
    case 'video':
    case 'current':
      return currentDisplay;
  }
}

function resolvePlacementBounds(
  workArea: Rectangle,
  width: number,
  height: number,
  preference: PictureInPicturePlacementPreference,
): Rectangle {
  const availableWidth = Math.max(0, workArea.width - width);
  const availableHeight = Math.max(0, workArea.height - height);
  if (preference.position === 'last' && preference.lastPlacement) {
    return {
      x: Math.round(workArea.x + availableWidth * preference.lastPlacement.xRatio),
      y: Math.round(workArea.y + availableHeight * preference.lastPlacement.yRatio),
      width,
      height,
    };
  }

  const left = workArea.x + Math.min(PIP_MARGIN, availableWidth);
  const right = workArea.x + Math.max(0, availableWidth - PIP_MARGIN);
  const top = workArea.y + Math.min(PIP_MARGIN, availableHeight);
  const bottom = workArea.y + Math.max(0, availableHeight - PIP_MARGIN);
  const position = preference.position === 'last' ? 'top-right' : preference.position;
  return {
    x: position.endsWith('left') ? left : right,
    y: position.startsWith('top') ? top : bottom,
    width,
    height,
  };
}

function captureLastPlacement(
  pipWindow: BrowserWindow,
): PictureInPictureLastPlacement {
  const bounds = pipWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const availableWidth = Math.max(0, display.workArea.width - bounds.width);
  const availableHeight = Math.max(0, display.workArea.height - bounds.height);
  return {
    displayId: String(display.id),
    xRatio:
      availableWidth > 0
        ? clampRatio((bounds.x - display.workArea.x) / availableWidth)
        : 0,
    yRatio:
      availableHeight > 0
        ? clampRatio((bounds.y - display.workArea.y) / availableHeight)
        : 0,
  };
}

function fitSizeWithinWorkArea(
  size: { readonly width: number; readonly height: number },
  workArea: Rectangle,
): { readonly width: number; readonly height: number } {
  const scale = Math.min(
    1,
    Math.max(1, workArea.width - PIP_MARGIN * 2) / size.width,
    Math.max(1, workArea.height - PIP_MARGIN * 2) / size.height,
  );
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

function isPointInside(
  point: Pick<Electron.MouseInputEvent, 'x' | 'y'>,
  bounds: Rectangle,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function resolveGlobalMousePoint(
  input: Electron.MouseInputEvent,
): { readonly x: number; readonly y: number } {
  if (
    typeof input.globalX === 'number' &&
    Number.isFinite(input.globalX) &&
    typeof input.globalY === 'number' &&
    Number.isFinite(input.globalY)
  ) {
    return { x: input.globalX, y: input.globalY };
  }
  return screen.getCursorScreenPoint();
}

function parseVideoCandidate(
  value: unknown,
): Omit<VideoCandidate, 'frame'> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as {
    score?: unknown;
    status?: unknown;
    videoHeight?: unknown;
    videoWidth?: unknown;
  };
  if (
    (candidate.status !== 'ready' && candidate.status !== 'not-ready') ||
    typeof candidate.score !== 'number' ||
    !Number.isFinite(candidate.score)
  ) {
    return undefined;
  }
  return {
    score: candidate.score,
    status: candidate.status,
    ...readAspectRatio(candidate),
  };
}

function isInspectableFrameUrl(url: string): boolean {
  return url !== '' && url !== 'about:blank';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseEnterResult(value: unknown): {
  readonly aspectRatio?: number;
  readonly status: PictureInPictureResult['status'];
} {
  if (!value || typeof value !== 'object') return { status: 'failed' };
  const candidate = value as { status?: unknown };
  const status = candidate.status;
  if (
    typeof status !== 'string' ||
    !['entered', 'no-video', 'not-ready', 'failed'].includes(status)
  ) {
    return { status: 'failed' };
  }
  return {
    status: status as PictureInPictureResult['status'],
    ...readAspectRatio(value),
  };
}

function readAspectRatio(value: object): { readonly aspectRatio?: number } {
  const candidate = value as { videoHeight?: unknown; videoWidth?: unknown };
  const width = Number(candidate.videoWidth);
  const height = Number(candidate.videoHeight);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { aspectRatio: width / height }
    : {};
}

function withWindowMode(
  status: PictureInPictureResult['status'],
): PictureInPictureResult {
  return { status, mode: 'window' };
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}
