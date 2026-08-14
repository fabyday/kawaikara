export const PICTURE_IN_PICTURE_SIZE_LIMITS = {
  minWidth: 320,
  maxWidth: 1920,
  minHeight: 180,
  maxHeight: 1080,
} as const;

export const PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM = {
  width: 200,
  height: 160,
} as const;

export const PICTURE_IN_PICTURE_SIZE_PRESETS = {
  compact: { width: 384, height: 216 },
  medium: { width: 512, height: 288 },
  large: { width: 640, height: 360 },
} as const;

export const PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS = {
  minWidth: 200,
  maxWidth: 1080,
  minHeight: 320,
  maxHeight: 1920,
} as const;

export const PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS = {
  compact: { width: 216, height: 384 },
  medium: { width: 288, height: 512 },
  large: { width: 360, height: 640 },
} as const;

export type PictureInPictureSizePreset =
  | keyof typeof PICTURE_IN_PICTURE_SIZE_PRESETS
  | 'custom';

export interface PictureInPictureSizePreference {
  readonly preset: PictureInPictureSizePreset;
  readonly width: number;
  readonly height: number;
}

export const PICTURE_IN_PICTURE_POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'last',
] as const;

export type PictureInPicturePosition =
  (typeof PICTURE_IN_PICTURE_POSITIONS)[number];

export type PictureInPictureMonitorMode =
  | 'current'
  | 'video'
  | 'last'
  | 'display';

export interface PictureInPictureMonitorPreference {
  readonly mode: PictureInPictureMonitorMode;
  readonly displayId?: string;
}

export interface PictureInPictureLastPlacement {
  readonly displayId: string;
  readonly xRatio: number;
  readonly yRatio: number;
}

export interface PictureInPicturePlacementPreference {
  readonly position: PictureInPicturePosition;
  readonly monitor: PictureInPictureMonitorPreference;
  readonly lastPlacement?: PictureInPictureLastPlacement;
}

export const DEFAULT_PICTURE_IN_PICTURE_SIZE: PictureInPictureSizePreference = {
  preset: 'medium',
  width: PICTURE_IN_PICTURE_SIZE_PRESETS.medium.width,
  height: PICTURE_IN_PICTURE_SIZE_PRESETS.medium.height,
};

export const DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE: PictureInPictureSizePreference =
  {
    preset: 'medium',
    width: PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS.medium.width,
    height: PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS.medium.height,
  };

export const DEFAULT_PICTURE_IN_PICTURE_PLACEMENT: PictureInPicturePlacementPreference =
  {
    position: 'top-right',
    monitor: { mode: 'current' },
  };

export function resolvePictureInPictureSize(
  preference: PictureInPictureSizePreference,
  videoAspectRatio?: number,
  orientation: 'landscape' | 'portrait' = 'landscape',
): { readonly width: number; readonly height: number } {
  const presets =
    orientation === 'portrait'
      ? PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS
      : PICTURE_IN_PICTURE_SIZE_PRESETS;
  const limits =
    orientation === 'portrait'
      ? PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS
      : PICTURE_IN_PICTURE_SIZE_LIMITS;
  if (preference.preset !== 'custom') {
    const preset = presets[preference.preset];
    if (!isUsableAspectRatio(videoAspectRatio)) return preset;
    const area = preset.width * preset.height;
    let width = Math.sqrt(area * videoAspectRatio);
    let height = width / videoAspectRatio;
    const minimumScale = Math.max(
      1,
      PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width / width,
      PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height / height,
    );
    width *= minimumScale;
    height *= minimumScale;
    const maximumScale = Math.min(
      1,
      limits.maxWidth / width,
      limits.maxHeight / height,
    );
    return {
      width: Math.round(width * maximumScale),
      height: Math.round(height * maximumScale),
    };
  }
  return {
    width: clampInteger(
      preference.width,
      limits.minWidth,
      limits.maxWidth,
    ),
    height: clampInteger(
      preference.height,
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}

function isUsableAspectRatio(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0.1 &&
    value <= 10
  );
}

export function validatePictureInPictureSize(
  value: unknown,
): PictureInPictureSizePreference {
  return validateSizePreference(
    value,
    PICTURE_IN_PICTURE_SIZE_LIMITS,
    DEFAULT_PICTURE_IN_PICTURE_SIZE,
  );
}

export function validatePictureInPicturePortraitSize(
  value: unknown,
): PictureInPictureSizePreference {
  return validateSizePreference(
    value,
    PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  );
}

function validateSizePreference(
  value: unknown,
  limits: {
    readonly maxHeight: number;
    readonly maxWidth: number;
    readonly minHeight: number;
    readonly minWidth: number;
  },
  defaults: PictureInPictureSizePreference,
): PictureInPictureSizePreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }
  const candidate = value as Partial<PictureInPictureSizePreference>;
  const preset = isPictureInPictureSizePreset(candidate.preset)
    ? candidate.preset
    : defaults.preset;
  return {
    preset,
    width: clampInteger(
      candidate.width,
      limits.minWidth,
      limits.maxWidth,
      defaults.width,
    ),
    height: clampInteger(
      candidate.height,
      limits.minHeight,
      limits.maxHeight,
      defaults.height,
    ),
  };
}

export function validatePictureInPicturePlacement(
  value: unknown,
): PictureInPicturePlacementPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  }
  const candidate = value as {
    lastPlacement?: unknown;
    monitor?: unknown;
    position?: unknown;
  };
  const position = PICTURE_IN_PICTURE_POSITIONS.includes(
    candidate.position as PictureInPicturePosition,
  )
    ? (candidate.position as PictureInPicturePosition)
    : DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.position;
  return {
    position,
    monitor: validatePictureInPictureMonitor(candidate.monitor),
    ...validateLastPlacement(candidate.lastPlacement),
  };
}

function validatePictureInPictureMonitor(
  value: unknown,
): PictureInPictureMonitorPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.monitor;
  }
  const candidate = value as { displayId?: unknown; mode?: unknown };
  const mode = ['current', 'video', 'last', 'display'].includes(
    String(candidate.mode),
  )
    ? (candidate.mode as PictureInPictureMonitorMode)
    : DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.monitor.mode;
  if (
    mode === 'display' &&
    typeof candidate.displayId === 'string' &&
    candidate.displayId.trim()
  ) {
    return { mode, displayId: candidate.displayId };
  }
  return mode === 'display'
    ? DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.monitor
    : { mode };
}

function validateLastPlacement(
  value: unknown,
): Partial<Pick<PictureInPicturePlacementPreference, 'lastPlacement'>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as {
    displayId?: unknown;
    xRatio?: unknown;
    yRatio?: unknown;
  };
  if (
    typeof candidate.displayId !== 'string' ||
    !candidate.displayId.trim() ||
    typeof candidate.xRatio !== 'number' ||
    !Number.isFinite(candidate.xRatio) ||
    typeof candidate.yRatio !== 'number' ||
    !Number.isFinite(candidate.yRatio)
  ) {
    return {};
  }
  return {
    lastPlacement: {
      displayId: candidate.displayId,
      xRatio: Math.min(1, Math.max(0, candidate.xRatio)),
      yRatio: Math.min(1, Math.max(0, candidate.yRatio)),
    },
  };
}

function isPictureInPictureSizePreset(
  value: unknown,
): value is PictureInPictureSizePreset {
  return ['compact', 'medium', 'large', 'custom'].includes(String(value));
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback = minimum,
): number {
  const number = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}
