import {
  screen,
  type BrowserWindow,
  type Display,
  type Rectangle,
  type WebContents,
  type WebFrameMain,
} from 'electron';
import type {
  PictureInPictureMode,
  PictureInPictureResult,
  PictureInPictureStatus,
} from '../../Common/IPC';
import {
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM,
  resolvePictureInPictureSize,
  type PictureInPictureLastPlacement,
  type PictureInPicturePlacementPreference,
  type PictureInPictureSizePreference,
} from '../../Common/PictureInPicture';
import { FullscreenWindowDetector } from './FullscreenWindowDetector';

const GAME_PIP_MARGIN = 20;

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

const TOGGLE_NATIVE_PIP_SCRIPT = `
  (async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return { status: 'exited' };
    }

    const result = ${FIND_VIDEO_SCRIPT};
    if (result.status !== 'ready') return { status: result.status };

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
      return (
        (!video.paused && !video.ended ? 1e15 : 0) +
        (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
        Math.max(0, rect.width) * Math.max(0, rect.height)
      );
    };
    videos.sort((left, right) => score(right) - score(left));
    const video =
      videos.find((candidate) => !candidate.disablePictureInPicture) ?? videos[0];
    if (!document.pictureInPictureEnabled ||
        typeof video.requestPictureInPicture !== 'function') {
      return { status: 'unsupported' };
    }
    if (video.disablePictureInPicture) return { status: 'disabled' };
    const pictureInPictureWindow = await video.requestPictureInPicture();
    return {
      status: 'entered',
      width: pictureInPictureWindow.width,
      height: pictureInPictureWindow.height,
    };
  })();
`;

const EXIT_NATIVE_PIP_SCRIPT = `
  (async () => {
    if (!document.pictureInPictureElement) return false;
    await document.exitPictureInPicture();
    return true;
  })();
`;

const HAS_NATIVE_PIP_SCRIPT = `Boolean(document.pictureInPictureElement);`;

const ENTER_GAME_PIP_SCRIPT = `
  (() => {
    const existing = window.__kawaikaraGamePictureInPicture;
    if (existing) return { status: 'entered' };

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
      return (
        (!video.paused && !video.ended ? 1e15 : 0) +
        (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
        Math.max(0, rect.width) * Math.max(0, rect.height)
      );
    };
    videos.sort((left, right) => score(right) - score(left));
    const video = videos[0];
    if (video.readyState === HTMLMediaElement.HAVE_NOTHING || !video.videoWidth) {
      return { status: 'not-ready' };
    }

    const elements = [];
    for (let element = video; element; element = element.parentElement) {
      elements.push({ element, style: element.getAttribute('style') });
    }
    const backdrop = document.createElement('div');
    backdrop.dataset.kawaikaraGamePipBackdrop = 'true';
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
      element.style.setProperty('overflow', 'visible', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
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
    video.style.setProperty('z-index', '2147483647', 'important');

    window.__kawaikaraGamePictureInPicture = {
      backdrop,
      controls: video.controls,
      elements,
      video,
    };
    video.controls = true;
    return {
      status: 'entered',
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  })();
`;

const EXIT_GAME_PIP_SCRIPT = `
  (() => {
    const state = window.__kawaikaraGamePictureInPicture;
    if (!state) return { status: 'exited' };
    state.video.controls = state.controls;
    for (const { element, style } of state.elements) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    state.backdrop.remove();
    delete window.__kawaikaraGamePictureInPicture;
    return { status: 'exited' };
  })();
`;

interface SavedWindowState {
  readonly alwaysOnTop: boolean;
  readonly bounds: Rectangle;
  readonly fullScreen: boolean;
  readonly maximized: boolean;
  readonly minimumSize: readonly [number, number];
  readonly movable: boolean;
  readonly resizable: boolean;
  readonly visibleOnAllWorkspaces: boolean;
}

interface GameModeState {
  readonly frame: WebFrameMain;
  readonly window: SavedWindowState;
}

interface VideoCandidate {
  readonly aspectRatio?: number;
  readonly frame: WebFrameMain;
  readonly score: number;
  readonly status: 'ready' | 'not-ready';
}

const FAILURE_PRIORITY: readonly PictureInPictureStatus[] = [
  'disabled',
  'not-ready',
  'unsupported',
  'no-video',
  'failed',
];

export class PictureInPictureManager {
  private readonly fullscreenWindows = new FullscreenWindowDetector();
  private gameMode?: GameModeState;
  private nativeVisibilityCheckRunning = false;
  private nativeVisibilityTimer?: NodeJS.Timeout;
  private nativeDisplayId?: string;
  private nativeWindowId?: string;
  private placementPreference = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  private placementWrite = Promise.resolve();
  private portraitSizePreference = DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
  private sizePreference = DEFAULT_PICTURE_IN_PICTURE_SIZE;

  constructor(
    private readonly getWindow: () => BrowserWindow,
    private readonly getWebContents: () => WebContents,
    private readonly onStateChanged: (result: PictureInPictureResult) => void,
    private readonly onNativeModeExited?: () => void,
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

  isGameModeActive(): boolean {
    return this.gameMode !== undefined;
  }

  isActive(): boolean {
    return this.gameMode !== undefined || this.nativeVisibilityTimer !== undefined;
  }

  async toggle(): Promise<PictureInPictureResult> {
    if (this.gameMode) {
      await this.exitGameMode();
      return withMode({ status: 'exited' }, 'window');
    }

    const viewerWindow = this.getWindow();
    if (await this.hasNativeMode(viewerWindow)) return this.toggleVideoMode();

    const videoResult = await this.toggleVideoMode();
    if (
      videoResult.status === 'entered' &&
      !this.nativeWindowId &&
      (await this.fullscreenWindows.hasExternalFullscreenWindow(viewerWindow))
    ) {
      const nativeDisplayId = this.nativeDisplayId;
      await this.exitNativeMode(viewerWindow);
      return this.toggleGameMode(nativeDisplayId);
    }
    if (
      videoResult.status === 'entered' ||
      videoResult.status === 'exited' ||
      videoResult.status === 'no-video' ||
      videoResult.status === 'not-ready'
    ) {
      return videoResult;
    }

    return this.toggleGameMode();
  }

  async toggleVideoMode(): Promise<PictureInPictureResult> {
    if (this.gameMode) await this.exitGameMode();
    const viewerWindow = this.getWindow();
    const webContents = this.getWebContents();
    const baseline = await this.fullscreenWindows.captureBaseline(viewerWindow);
    const failures = new Set<PictureInPictureStatus>();

    for (const frame of webContents.mainFrame.framesInSubtree) {
      if (frame.isDestroyed()) continue;
      try {
        const value = await frame.executeJavaScript(TOGGLE_NATIVE_PIP_SCRIPT, true);
        const { result, size } = parseNativePictureInPictureResult(value);
        if (result.status === 'entered' || result.status === 'exited') {
          if (result.status === 'entered') {
            const windowId =
              await this.fullscreenWindows.findNewPictureInPictureWindow(
                viewerWindow,
                baseline,
                size,
              );
            if (windowId) {
              const observation =
                await this.fullscreenWindows.getTrackedWindowVisibility(
                  viewerWindow,
                  windowId,
                );
              this.nativeDisplayId = observation.displayId;
              if (observation.visibility === 'occluded') {
                const nativeDisplayId = observation.displayId;
                await this.exitNativeMode(viewerWindow);
                return this.toggleGameMode(nativeDisplayId);
              }
            }
            this.startNativeVisibilityMonitor(
              viewerWindow,
              windowId,
              this.nativeDisplayId,
            );
          } else {
            this.stopNativeVisibilityMonitor();
          }
          return withMode(result, 'video');
        }
        failures.add(result.status);
      } catch (error) {
        console.debug(`PiP could not inspect frame ${frame.url}.`, error);
        failures.add('failed');
      }
    }

    return withMode(failureResult(failures), 'video');
  }

  async toggleGameMode(
    nativeDisplayId?: string,
  ): Promise<PictureInPictureResult> {
    if (this.gameMode) {
      await this.exitGameMode();
      return withMode({ status: 'exited' }, 'window');
    }

    const viewerWindow = this.getWindow();
    const sourceDisplayId = nativeDisplayId ?? this.nativeDisplayId;
    this.stopNativeVisibilityMonitor();
    await this.exitNativeMode(viewerWindow);
    const candidate = await this.findVideoCandidate(viewerWindow);
    if (!candidate) return withMode({ status: 'no-video' }, 'window');
    if (candidate.status === 'not-ready') {
      return withMode({ status: 'not-ready' }, 'window');
    }

    const minimumSize = viewerWindow.getMinimumSize();
    const savedWindow: SavedWindowState = {
      alwaysOnTop: viewerWindow.isAlwaysOnTop(),
      bounds: viewerWindow.getBounds(),
      fullScreen: viewerWindow.isFullScreen(),
      maximized: viewerWindow.isMaximized(),
      minimumSize: [minimumSize[0] ?? 0, minimumSize[1] ?? 0],
      movable: viewerWindow.isMovable(),
      resizable: viewerWindow.isResizable(),
      visibleOnAllWorkspaces: viewerWindow.isVisibleOnAllWorkspaces(),
    };

    try {
      const { result, aspectRatio } = parseGamePictureInPictureResult(
        await candidate.frame.executeJavaScript(ENTER_GAME_PIP_SCRIPT, true),
      );
      if (result.status !== 'entered') return withMode(result, 'window');

      this.gameMode = { frame: candidate.frame, window: savedWindow };
      await this.enterCompactWindow(
        viewerWindow,
        savedWindow.bounds,
        sourceDisplayId,
        aspectRatio ?? candidate.aspectRatio,
      );
      return withMode(result, 'window');
    } catch (error) {
      console.error('Game PiP could not be started.', error);
      await this.restoreInjectedVideo(candidate.frame);
      this.restoreWindow(viewerWindow, savedWindow);
      this.gameMode = undefined;
      return withMode({ status: 'failed' }, 'window');
    }
  }

  async exitGameMode(): Promise<void> {
    const state = this.gameMode;
    if (!state) return;
    const viewerWindow = this.getWindow();
    await this.rememberCurrentPlacement(viewerWindow);
    this.gameMode = undefined;
    await this.restoreInjectedVideo(state.frame);
    if (!viewerWindow.isDestroyed()) this.restoreWindow(viewerWindow, state.window);
  }

  async exitAllModes(): Promise<void> {
    const activeMode: PictureInPictureMode | undefined = this.gameMode
      ? 'window'
      : this.nativeVisibilityTimer
        ? 'video'
        : undefined;
    if (this.gameMode) {
      await this.exitGameMode();
    } else if (this.nativeVisibilityTimer) {
      this.stopNativeVisibilityMonitor();
      const viewerWindow = this.getWindow();
      if (!viewerWindow.isDestroyed()) await this.exitNativeMode(viewerWindow);
    }
    await this.placementWrite;
    if (activeMode) this.onStateChanged(withMode({ status: 'exited' }, activeMode));
  }

  async rememberCurrentPlacement(viewerWindow = this.getWindow()): Promise<void> {
    if (!this.gameMode || viewerWindow.isDestroyed()) return;
    const placement = captureLastPlacement(viewerWindow);
    if (!placement || !this.onLastPlacementChanged) return;
    this.placementWrite = this.placementWrite
      .then(() => this.onLastPlacementChanged?.(placement))
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn('The last PiP position could not be saved.', error);
      });
    await this.placementWrite;
  }

  handleViewerClosed(): void {
    this.stopNativeVisibilityMonitor();
    this.gameMode = undefined;
  }

  private async findVideoCandidate(
    viewerWindow: BrowserWindow,
  ): Promise<VideoCandidate | undefined> {
    let best: VideoCandidate | undefined;
    for (const frame of this.getWebContents().mainFrame.framesInSubtree) {
      if (frame.isDestroyed()) continue;
      try {
        const result = parseVideoCandidate(
          await frame.executeJavaScript(FIND_VIDEO_SCRIPT),
        );
        if (!result || (best && result.score <= best.score)) continue;
        best = { frame, ...result };
      } catch (error) {
        console.debug(`Game PiP could not inspect frame ${frame.url}.`, error);
      }
    }
    return best;
  }

  private async exitNativeMode(viewerWindow: BrowserWindow): Promise<void> {
    this.stopNativeVisibilityMonitor();
    for (const frame of this.getWebContents().mainFrame.framesInSubtree) {
      if (frame.isDestroyed()) continue;
      try {
        if (await frame.executeJavaScript(EXIT_NATIVE_PIP_SCRIPT)) return;
      } catch (error) {
        console.debug(
          `Native PiP could not be closed in frame ${frame.url}.`,
          error,
        );
      }
    }
  }

  private async hasNativeMode(viewerWindow: BrowserWindow): Promise<boolean> {
    for (const frame of this.getWebContents().mainFrame.framesInSubtree) {
      if (frame.isDestroyed()) continue;
      try {
        if (await frame.executeJavaScript(HAS_NATIVE_PIP_SCRIPT)) return true;
      } catch (error) {
        console.debug(
          `Native PiP state was unavailable in frame ${frame.url}.`,
          error,
        );
      }
    }
    return false;
  }

  private startNativeVisibilityMonitor(
    viewerWindow: BrowserWindow,
    windowId?: string,
    displayId?: string,
  ): void {
    if (this.nativeVisibilityTimer) clearInterval(this.nativeVisibilityTimer);
    this.nativeWindowId = windowId;
    this.nativeDisplayId = displayId;
    this.nativeVisibilityCheckRunning = false;
    this.nativeVisibilityTimer = setInterval(() => {
      void this.checkNativeVisibility(viewerWindow);
    }, process.platform === 'win32' ? 1000 : 1250);
    this.nativeVisibilityTimer.unref();
  }

  private stopNativeVisibilityMonitor(): void {
    if (this.nativeVisibilityTimer) clearInterval(this.nativeVisibilityTimer);
    this.nativeVisibilityTimer = undefined;
    this.nativeWindowId = undefined;
    this.nativeDisplayId = undefined;
    this.nativeVisibilityCheckRunning = false;
    this.fullscreenWindows.dispose();
  }

  private async checkNativeVisibility(
    viewerWindow: BrowserWindow,
  ): Promise<void> {
    const windowId = this.nativeWindowId;
    if (
      this.nativeVisibilityCheckRunning ||
      viewerWindow.isDestroyed()
    ) {
      return;
    }
    this.nativeVisibilityCheckRunning = true;
    try {
      if (!windowId) {
        if (!(await this.hasNativeMode(viewerWindow))) {
          this.stopNativeVisibilityMonitor();
          this.onStateChanged(withMode({ status: 'exited' }, 'video'));
          this.onNativeModeExited?.();
          return;
        }
        if (
          !(await this.fullscreenWindows.hasExternalFullscreenWindow(
            viewerWindow,
          ))
        ) {
          return;
        }
        console.info(
          'Video PiP could not be tracked and an external fullscreen window appeared; switching to window PiP.',
        );
        this.stopNativeVisibilityMonitor();
        await this.exitNativeMode(viewerWindow);
        this.onStateChanged(await this.toggleGameMode());
        return;
      }
      const observation =
        await this.fullscreenWindows.getTrackedWindowVisibility(
          viewerWindow,
          windowId,
        );
      if (this.nativeWindowId !== windowId) return;
      this.nativeDisplayId = observation.displayId ?? this.nativeDisplayId;
      if (observation.visibility === 'missing') {
        if (await this.hasNativeMode(viewerWindow)) {
          const nativeDisplayId = this.nativeDisplayId;
          console.info(
            'Video PiP is still active but no longer visible to the window server; switching to window PiP.',
          );
          this.stopNativeVisibilityMonitor();
          await this.exitNativeMode(viewerWindow);
          this.onStateChanged(await this.toggleGameMode(nativeDisplayId));
          return;
        }
        this.stopNativeVisibilityMonitor();
        this.onStateChanged(withMode({ status: 'exited' }, 'video'));
        this.onNativeModeExited?.();
        return;
      }
      if (observation.visibility !== 'occluded') return;

      console.info(
        'Video PiP moved behind an external fullscreen window; switching to window PiP.',
      );
      const nativeDisplayId = this.nativeDisplayId;
      this.stopNativeVisibilityMonitor();
      await this.exitNativeMode(viewerWindow);
      this.onStateChanged(await this.toggleGameMode(nativeDisplayId));
    } catch (error) {
      console.debug('Video PiP visibility could not be checked.', error);
    } finally {
      this.nativeVisibilityCheckRunning = false;
    }
  }

  private async enterCompactWindow(
    viewerWindow: BrowserWindow,
    previousBounds: Rectangle,
    nativeDisplayId?: string,
    videoAspectRatio?: number,
  ): Promise<void> {
    if (viewerWindow.isFullScreen()) viewerWindow.setFullScreen(false);
    if (viewerWindow.isMaximized()) viewerWindow.unmaximize();

    const display = resolvePlacementDisplay(
      previousBounds,
      nativeDisplayId,
      this.placementPreference,
    );
    const workArea = display.workArea;
    const portrait =
      typeof videoAspectRatio === 'number' && videoAspectRatio < 1;
    const preferredSize = resolvePictureInPictureSize(
      portrait ? this.portraitSizePreference : this.sizePreference,
      videoAspectRatio,
      portrait ? 'portrait' : 'landscape',
    );
    const fittedSize = fitSizeWithinWorkArea(preferredSize, workArea);
    const width = fittedSize.width;
    const height = fittedSize.height;
    viewerWindow.setMinimumSize(
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width, width),
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height, height),
    );
    viewerWindow.setMovable(true);
    viewerWindow.setResizable(true);
    viewerWindow.setBounds(
      resolvePlacementBounds(
        workArea,
        width,
        height,
        this.placementPreference,
      ),
      false,
    );

    if (process.platform === 'darwin') {
      viewerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      viewerWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } else {
      viewerWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }
    viewerWindow.showInactive();
    viewerWindow.moveTop();
  }

  private restoreWindow(
    viewerWindow: BrowserWindow,
    state: SavedWindowState,
  ): void {
    viewerWindow.setAlwaysOnTop(false);
    if (process.platform === 'darwin') {
      viewerWindow.setVisibleOnAllWorkspaces(state.visibleOnAllWorkspaces, {
        visibleOnFullScreen: state.visibleOnAllWorkspaces,
      });
    }
    viewerWindow.setMinimumSize(...state.minimumSize);
    viewerWindow.setMovable(state.movable);
    viewerWindow.setResizable(state.resizable);
    viewerWindow.setBounds(state.bounds, false);
    if (state.alwaysOnTop) viewerWindow.setAlwaysOnTop(true);
    if (state.maximized) viewerWindow.maximize();
    if (state.fullScreen) viewerWindow.setFullScreen(true);
  }

  private async restoreInjectedVideo(frame: WebFrameMain): Promise<void> {
    if (frame.isDestroyed()) return;
    await frame.executeJavaScript(EXIT_GAME_PIP_SCRIPT).catch((error: unknown) => {
      console.debug('Game PiP video styles were already unavailable.', error);
    });
  }
}

function resolvePlacementDisplay(
  previousBounds: Rectangle,
  nativeDisplayId: string | undefined,
  preference: PictureInPicturePlacementPreference,
): Display {
  const displays = screen.getAllDisplays();
  const byId = (displayId: string | undefined) =>
    displayId
      ? displays.find((display) => String(display.id) === displayId)
      : undefined;
  const currentDisplay = screen.getDisplayMatching(previousBounds);
  switch (preference.monitor.mode) {
    case 'display':
      return byId(preference.monitor.displayId) ?? currentDisplay;
    case 'last':
      return byId(preference.lastPlacement?.displayId) ?? currentDisplay;
    case 'video':
      return byId(nativeDisplayId) ?? currentDisplay;
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
      x: Math.round(
        workArea.x + availableWidth * preference.lastPlacement.xRatio,
      ),
      y: Math.round(
        workArea.y + availableHeight * preference.lastPlacement.yRatio,
      ),
      width,
      height,
    };
  }

  const left = workArea.x + Math.min(GAME_PIP_MARGIN, availableWidth);
  const right = workArea.x + Math.max(0, availableWidth - GAME_PIP_MARGIN);
  const top = workArea.y + Math.min(GAME_PIP_MARGIN, availableHeight);
  const bottom = workArea.y + Math.max(0, availableHeight - GAME_PIP_MARGIN);
  const position =
    preference.position === 'last' ? 'top-right' : preference.position;
  return {
    x: position.endsWith('left') ? left : right,
    y: position.startsWith('top') ? top : bottom,
    width,
    height,
  };
}

function captureLastPlacement(
  viewerWindow: BrowserWindow,
): PictureInPictureLastPlacement | undefined {
  if (viewerWindow.isDestroyed()) return undefined;
  const bounds = viewerWindow.getBounds();
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

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fitSizeWithinWorkArea(
  size: { readonly width: number; readonly height: number },
  workArea: Rectangle,
): { readonly width: number; readonly height: number } {
  const scale = Math.min(
    1,
    Math.max(1, workArea.width - GAME_PIP_MARGIN * 2) / size.width,
    Math.max(1, workArea.height - GAME_PIP_MARGIN * 2) / size.height,
  );
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
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
    ...readVideoAspectRatio(candidate),
  };
}

function failureResult(
  failures: ReadonlySet<PictureInPictureStatus>,
): PictureInPictureResult {
  return {
    status: FAILURE_PRIORITY.find((status) => failures.has(status)) ?? 'no-video',
  };
}

function parsePictureInPictureResult(value: unknown): PictureInPictureResult {
  if (value && typeof value === 'object' && 'status' in value) {
    const status = (value as { status?: unknown }).status;
    if (
      typeof status === 'string' &&
      [
        'entered',
        'exited',
        'no-video',
        'not-ready',
        'disabled',
        'unsupported',
        'failed',
      ].includes(status)
    ) {
      return { status: status as PictureInPictureStatus };
    }
  }
  return { status: 'failed' };
}

function parseGamePictureInPictureResult(value: unknown): {
  readonly aspectRatio?: number;
  readonly result: PictureInPictureResult;
} {
  const result = parsePictureInPictureResult(value);
  if (!value || typeof value !== 'object') return { result };
  return { result, ...readVideoAspectRatio(value) };
}

function readVideoAspectRatio(value: object): { readonly aspectRatio?: number } {
  const candidate = value as { videoHeight?: unknown; videoWidth?: unknown };
  const width = Number(candidate.videoWidth);
  const height = Number(candidate.videoHeight);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { aspectRatio: width / height }
    : {};
}

function parseNativePictureInPictureResult(value: unknown): {
  readonly result: PictureInPictureResult;
  readonly size?: { readonly width: number; readonly height: number };
} {
  const result = parsePictureInPictureResult(value);
  if (!value || typeof value !== 'object') return { result };
  const candidate = value as { height?: unknown; width?: unknown };
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  return Number.isFinite(width) && Number.isFinite(height)
    ? { result, size: { width, height } }
    : { result };
}

function withMode(
  result: PictureInPictureResult,
  mode: PictureInPictureMode,
): PictureInPictureResult {
  return { ...result, mode };
}
