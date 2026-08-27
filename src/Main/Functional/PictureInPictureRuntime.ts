import {
  screen,
  type BrowserWindow,
  type Display,
  type Input,
  type Rectangle,
  type WebContentsView,
  type WebFrameMain,
} from 'electron';
import type { PictureInPictureResult } from '../../Common/IPC';
import type {
  PictureInPictureLastPlacement,
  PictureInPicturePlacementPreference,
} from '../../Common/PictureInPicture';

/** Defines the shared PiP margin constant. */
const PIP_MARGIN = 20;

/** Describes the parsed video candidate contract. */
export interface ParsedVideoCandidate {
  /** The aspect ratio value. */
  readonly aspectRatio?: number;
  /** The score value. */
  readonly score: number;
  /** The status value. */
  readonly status: 'ready' | 'not-ready';
}

/** Describes the picture in picture video candidate contract. */
export interface PictureInPictureVideoCandidate {
  /** The aspect ratio value. */
  readonly aspectRatio?: number;
  /** The frame value. */
  readonly frame: WebFrameMain;
  /** The score value. */
  readonly score: number;
  /** The status value. */
  readonly status: 'ready' | 'not-ready';
}

/** Describes the unified picture in picture state contract. */
export interface UnifiedPictureInPictureState {
  /** Whether the closing option is enabled. */
  closing: boolean;
  /** Whether the controls visible option is enabled. */
  controlsVisible: boolean;
  /** The last control action value. */
  lastControlAction?: {
    /** The action value. */
    readonly action: 'playback' | 'restore';
    /** The at value. */
    readonly at: number;
  };
  /** The drag state value. */
  dragState?: {
    /** The cursor x value. */
    readonly cursorX: number;
    /** The cursor y value. */
    readonly cursorY: number;
    /** The window x value. */
    readonly windowX: number;
    /** The window y value. */
    readonly windowY: number;
  };
  /** Callback used to handle console listener. */
  readonly consoleListener: (
    details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
  ) => void;
  /** The frame value. */
  frame: WebFrameMain;
  /** Callback used to handle input listener. */
  readonly inputListener: (event: Electron.Event, input: Input) => void;
  /** The host frames value. */
  hostFrames: readonly WebFrameMain[];
  /** Callback used to handle media started listener. */
  readonly mediaStartedListener: () => void;
  /** Callback used to handle navigation listener. */
  readonly navigationListener: () => void;
  /** Callback used to handle pointer input listener. */
  readonly pointerInputListener: (
    event: Electron.Event,
    input: Electron.InputEvent,
  ) => void;
  /** The PiP window value. */
  readonly pipWindow: BrowserWindow;
  /** The site view value. */
  readonly siteView: WebContentsView;
  /** The viewer window value. */
  readonly viewerWindow: BrowserWindow;
  /** The fullscreen reassert timers value. */
  readonly fullscreenReassertTimers: Set<ReturnType<typeof setTimeout>>;
  /** The video refresh timers value. */
  readonly videoRefreshTimers: Set<ReturnType<typeof setTimeout>>;
  /** Whether the refreshing video option is enabled. */
  refreshingVideo: boolean;
  /** The hover timer value. */
  hoverTimer?: ReturnType<typeof setInterval>;
}

/** Resolves the picture in picture display. */
export function resolvePictureInPictureDisplay(
  viewerBounds: Rectangle,
  preference: PictureInPicturePlacementPreference,
): Display {
  const displays = screen.getAllDisplays();
  /** Performs the by ID operation. */
  const byId = (displayId: string | undefined): Display | undefined =>
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

/** Resolves the picture in picture bounds. */
export function resolvePictureInPictureBounds(
  workArea: Rectangle,
  width: number,
  height: number,
  preference: PictureInPicturePlacementPreference,
): Rectangle {
  const availableWidth = Math.max(0, workArea.width - width);
  const availableHeight = Math.max(0, workArea.height - height);
  if (preference.position === 'last' && preference.lastPlacement) {
    return {
      /** The x value. */
      x: Math.round(workArea.x + availableWidth * preference.lastPlacement.xRatio),
      /** The y value. */
      y: Math.round(workArea.y + availableHeight * preference.lastPlacement.yRatio),
      /** The width value. */
      width,
      /** The height value. */
      height,
    };
  }
  const left = workArea.x + Math.min(PIP_MARGIN, availableWidth);
  const right = workArea.x + Math.max(0, availableWidth - PIP_MARGIN);
  const top = workArea.y + Math.min(PIP_MARGIN, availableHeight);
  const bottom = workArea.y + Math.max(0, availableHeight - PIP_MARGIN);
  const position = preference.position === 'last'
    ? 'top-right'
    : preference.position;
  return {
    /** The x value. */
    x: position.endsWith('left') ? left : right,
    /** The y value. */
    y: position.startsWith('top') ? top : bottom,
    /** The width value. */
    width,
    /** The height value. */
    height,
  };
}

/** Performs the capture picture in picture placement operation. */
export function capturePictureInPicturePlacement(
  pipWindow: BrowserWindow,
): PictureInPictureLastPlacement {
  const bounds = pipWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const availableWidth = Math.max(0, display.workArea.width - bounds.width);
  const availableHeight = Math.max(0, display.workArea.height - bounds.height);
  return {
    /** The display ID value. */
    displayId: String(display.id),
    /** The x ratio value. */
    xRatio: availableWidth > 0
      ? clampRatio((bounds.x - display.workArea.x) / availableWidth)
      : 0,
    /** The y ratio value. */
    yRatio: availableHeight > 0
      ? clampRatio((bounds.y - display.workArea.y) / availableHeight)
      : 0,
  };
}

/** Performs the fit picture in picture size operation. */
export function fitPictureInPictureSize(
  size: {
    /** The width value. */
    readonly width: number;
    /** The height value. */
    readonly height: number;
  },
  workArea: Rectangle,
): {
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
} {
  const scale = Math.min(
    1,
    Math.max(1, workArea.width - PIP_MARGIN * 2) / size.width,
    Math.max(1, workArea.height - PIP_MARGIN * 2) / size.height,
  );
  return {
    /** The width value. */
    width: Math.max(1, Math.round(size.width * scale)),
    /** The height value. */
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** Determines whether the point inside condition applies. */
export function isPointInside(
  point: Pick<Electron.MouseInputEvent, 'x' | 'y'>,
  bounds: Rectangle,
): boolean {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width &&
    point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

/** Resolves the global mouse point. */
export function resolveGlobalMousePoint(
  input: Electron.MouseInputEvent,
): {
  /** The x value. */
  readonly x: number;
  /** The y value. */
  readonly y: number;
} {
  if (
    typeof input.globalX === 'number' && Number.isFinite(input.globalX) &&
    typeof input.globalY === 'number' && Number.isFinite(input.globalY)
  ) {
    return {
      /** The x value. */
      x: input.globalX,
      /** The y value. */
      y: input.globalY,
    };
  }
  return screen.getCursorScreenPoint();
}

/** Parses the video candidate. */
export function parseVideoCandidate(
  value: unknown,
): ParsedVideoCandidate | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { score?: unknown; status?: unknown
  };
  if (
    (candidate.status !== 'ready' && candidate.status !== 'not-ready') ||
    typeof candidate.score !== 'number' || !Number.isFinite(candidate.score)
  ) {
    return undefined;
  }
  return {
    /** The score value. */
    score: candidate.score,
    /** The status value. */
    status: candidate.status,
    ...readAspectRatio(value),
  };
}

/** Parses the picture in picture enter result. */
export function parsePictureInPictureEnterResult(value: unknown): {
  /** The aspect ratio value. */
  readonly aspectRatio?: number;
  /** The status value. */
  readonly status: PictureInPictureResult['status'];
} {
  if (!value || typeof value !== 'object') return {
    /** The status value. */
    status: 'failed',
  };
  const status = (value as { status?: unknown
  }).status;
  if (
    typeof status !== 'string' ||
    !['entered', 'no-video', 'not-ready', 'failed'].includes(status)
  ) {
    return {
      /** The status value. */
      status: 'failed',
    };
  }
  return {
    /** The status value. */
    status: status as PictureInPictureResult['status'],
    ...readAspectRatio(value),
  };
}

/** Performs the with picture in picture window mode operation. */
export function withPictureInPictureWindowMode(
  status: PictureInPictureResult['status'],
): PictureInPictureResult {
  return {
    /** The status value. */
    status,
    /** The mode value. */
    mode: 'window',
  };
}

/** Determines whether the inspectable frame URL condition applies. */
export function isInspectableFrameUrl(url: string): boolean {
  return url !== '' && url !== 'about:blank';
}

/** Performs the delay operation. */
export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Reads the aspect ratio. */
function readAspectRatio(value: object): {
  /** The aspect ratio value. */
  readonly aspectRatio?: number;
} {
  const candidate = value as { videoHeight?: unknown; videoWidth?: unknown
  };
  const width = Number(candidate.videoWidth);
  const height = Number(candidate.videoHeight);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? {
      /** The aspect ratio value. */
      aspectRatio: width / height,
    }
    : {};
}

/** Performs the clamp ratio operation. */
function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}
