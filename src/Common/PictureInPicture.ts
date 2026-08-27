/** Defines the shared picture in picture size limits constant. */
export const PICTURE_IN_PICTURE_SIZE_LIMITS = {
  /** The min width value. */
  minWidth: 320,
  /** The max width value. */
  maxWidth: 1920,
  /** The min height value. */
  minHeight: 180,
  /** The max height value. */
  maxHeight: 1080,
} as const;

/** Defines the shared picture in picture automatic minimum constant. */
export const PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM = {
  /** The width value. */
  width: 200,
  /** The height value. */
  height: 160,
} as const;

/** Defines the shared picture in picture size presets constant. */
export const PICTURE_IN_PICTURE_SIZE_PRESETS = {
  /** The compact value. */
  compact: {
    /** The width value. */
    width: 384,
    /** The height value. */
    height: 216,
  },
  /** The medium value. */
  medium: {
    /** The width value. */
    width: 512,
    /** The height value. */
    height: 288,
  },
  /** The large value. */
  large: {
    /** The width value. */
    width: 640,
    /** The height value. */
    height: 360,
  },
} as const;

/** Defines the shared picture in picture portrait size limits constant. */
export const PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS = {
  /** The min width value. */
  minWidth: 200,
  /** The max width value. */
  maxWidth: 1080,
  /** The min height value. */
  minHeight: 320,
  /** The max height value. */
  maxHeight: 1920,
} as const;

/** Defines the shared picture in picture portrait size presets constant. */
export const PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS = {
  /** The compact value. */
  compact: {
    /** The width value. */
    width: 216,
    /** The height value. */
    height: 384,
  },
  /** The medium value. */
  medium: {
    /** The width value. */
    width: 288,
    /** The height value. */
    height: 512,
  },
  /** The large value. */
  large: {
    /** The width value. */
    width: 360,
    /** The height value. */
    height: 640,
  },
} as const;

/** Defines the picture in picture size preset type. */
export type PictureInPictureSizePreset =
  | keyof typeof PICTURE_IN_PICTURE_SIZE_PRESETS
  | 'custom';

/** Describes the picture in picture size preference contract. */
export interface PictureInPictureSizePreference {
  /** The preset value. */
  readonly preset: PictureInPictureSizePreset;
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
}

/** Defines the shared picture in picture positions constant. */
export const PICTURE_IN_PICTURE_POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'last',
] as const;

/** Defines the picture in picture position type. */
export type PictureInPicturePosition =
  (typeof PICTURE_IN_PICTURE_POSITIONS)[number];

/** Defines the picture in picture monitor mode type. */
export type PictureInPictureMonitorMode =
  | 'current'
  | 'video'
  | 'last'
  | 'display';

/** Describes the picture in picture monitor preference contract. */
export interface PictureInPictureMonitorPreference {
  /** The mode value. */
  readonly mode: PictureInPictureMonitorMode;
  /** The display ID value. */
  readonly displayId?: string;
}

/** Describes the picture in picture last placement contract. */
export interface PictureInPictureLastPlacement {
  /** The display ID value. */
  readonly displayId: string;
  /** The x ratio value. */
  readonly xRatio: number;
  /** The y ratio value. */
  readonly yRatio: number;
}

/** Describes the picture in picture placement preference contract. */
export interface PictureInPicturePlacementPreference {
  /** The position value. */
  readonly position: PictureInPicturePosition;
  /** The monitor value. */
  readonly monitor: PictureInPictureMonitorPreference;
  /** The last placement value. */
  readonly lastPlacement?: PictureInPictureLastPlacement;
}

/** Defines the shared default picture in picture size constant. */
export const DEFAULT_PICTURE_IN_PICTURE_SIZE: PictureInPictureSizePreference = {
  /** The preset value. */
  preset: 'medium',
  /** The width value. */
  width: PICTURE_IN_PICTURE_SIZE_PRESETS.medium.width,
  /** The height value. */
  height: PICTURE_IN_PICTURE_SIZE_PRESETS.medium.height,
};

/** Defines the shared default picture in picture portrait size constant. */
export const DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE: PictureInPictureSizePreference =
  {
    /** The preset value. */
    preset: 'medium',
    /** The width value. */
    width: PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS.medium.width,
    /** The height value. */
    height: PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS.medium.height,
  };

/** Defines the shared default picture in picture placement constant. */
export const DEFAULT_PICTURE_IN_PICTURE_PLACEMENT: PictureInPicturePlacementPreference =
  {
    /** The position value. */
    position: 'top-right',
    /** The monitor value. */
    monitor: {
      /** The mode value. */
      mode: 'current',
    },
  };

/** Resolves the picture in picture size. */
export function resolvePictureInPictureSize(
  preference: PictureInPictureSizePreference,
  videoAspectRatio?: number,
  orientation: 'landscape' | 'portrait' = 'landscape',
): {
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
} {
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
      /** The width value. */
      width: Math.round(width * maximumScale),
      /** The height value. */
      height: Math.round(height * maximumScale),
    };
  }
  return {
    /** The width value. */
    width: clampInteger(
      preference.width,
      limits.minWidth,
      limits.maxWidth,
    ),
    /** The height value. */
    height: clampInteger(
      preference.height,
      limits.minHeight,
      limits.maxHeight,
    ),
  };
}

/** Determines whether the usable aspect ratio condition applies. */
function isUsableAspectRatio(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0.1 &&
    value <= 10
  );
}

/** Validates the picture in picture size. */
export function validatePictureInPictureSize(
  value: unknown,
): PictureInPictureSizePreference {
  return validateSizePreference(
    value,
    PICTURE_IN_PICTURE_SIZE_LIMITS,
    DEFAULT_PICTURE_IN_PICTURE_SIZE,
  );
}

/** Validates the picture in picture portrait size. */
export function validatePictureInPicturePortraitSize(
  value: unknown,
): PictureInPictureSizePreference {
  return validateSizePreference(
    value,
    PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  );
}

/** Validates the size preference. */
function validateSizePreference(
  value: unknown,
  limits: {
    /** The max height value. */
    readonly maxHeight: number;
    /** The max width value. */
    readonly maxWidth: number;
    /** The min height value. */
    readonly minHeight: number;
    /** The min width value. */
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
    /** The preset value. */
    preset,
    /** The width value. */
    width: clampInteger(
      candidate.width,
      limits.minWidth,
      limits.maxWidth,
      defaults.width,
    ),
    /** The height value. */
    height: clampInteger(
      candidate.height,
      limits.minHeight,
      limits.maxHeight,
      defaults.height,
    ),
  };
}

/** Validates the picture in picture placement. */
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
    /** The position value. */
    position,
    /** The monitor value. */
    monitor: validatePictureInPictureMonitor(candidate.monitor),
    ...validateLastPlacement(candidate.lastPlacement),
  };
}

/** Validates the picture in picture monitor. */
function validatePictureInPictureMonitor(
  value: unknown,
): PictureInPictureMonitorPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.monitor;
  }
  const candidate = value as { displayId?: unknown; mode?: unknown
  };
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
    return {
      /** The mode value. */
      mode,
      /** The display ID value. */
      displayId: candidate.displayId,
    };
  }
  return mode === 'display'
    ? DEFAULT_PICTURE_IN_PICTURE_PLACEMENT.monitor
    : {
      /** The mode value. */
      mode,
    };
}

/** Validates the last placement. */
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
    /** The last placement value. */
    lastPlacement: {
      /** The display ID value. */
      displayId: candidate.displayId,
      /** The x ratio value. */
      xRatio: Math.min(1, Math.max(0, candidate.xRatio)),
      /** The y ratio value. */
      yRatio: Math.min(1, Math.max(0, candidate.yRatio)),
    },
  };
}

/** Determines whether the picture in picture size preset condition applies. */
function isPictureInPictureSizePreset(
  value: unknown,
): value is PictureInPictureSizePreset {
  return ['compact', 'medium', 'large', 'custom'].includes(String(value));
}

/** Performs the clamp integer operation. */
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
