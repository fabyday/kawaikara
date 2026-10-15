/** Startup presets retained from the original main-branch window manager. */
export const APP_WINDOW_SIZE_PRESETS = [
    {
        /** The width value. */
        width: 720,
        /** The height value. */
        height: 480,
    },
    {
        /** The width value. */
        width: 720,
        /** The height value. */
        height: 576,
    },
    {
        /** The width value. */
        width: 800,
        /** The height value. */
        height: 600,
    },
    {
        /** The width value. */
        width: 1280,
        /** The height value. */
        height: 720,
    },
    {
        /** The width value. */
        width: 1920,
        /** The height value. */
        height: 1080,
    },
    {
        /** The width value. */
        width: 3840,
        /** The height value. */
        height: 2160,
    },
    {
        /** The width value. */
        width: 7680,
        /** The height value. */
        height: 4320,
    },
] as const;

/** Shared limits for manual input and native startup bounds. */
export const APP_WINDOW_SIZE_LIMITS = {
    /** The min width value. */
    minWidth: 720,
    /** The min height value. */
    minHeight: 480,
    /** The max width value. */
    maxWidth: 2147483647,
    /** The max height value. */
    maxHeight: 2147483647,
} as const;

/** Startup-only window settings, independent of PiP and live window resizing. */
export interface AppWindowPreference {
    /** A resolution string from the preset list, or custom. */
    readonly preset: string;
    /** Manual width in Electron logical pixels. */
    readonly width: number;
    /** Manual height in Electron logical pixels. */
    readonly height: number;
    /** Selects the last closing position, primary display, or a specific display. */
    readonly monitor: 'last-position' | 'last-display' | 'primary' | 'display';
    /** Reopen using the last normal size or filled-work-area intent. */
    readonly rememberSize?: boolean;
    /** Stable Electron display ID for explicit selection. */
    readonly displayId?: string;
}

/** Last normal-window position; stored separately from editable startup settings. */
export interface AppWindowLastPosition {
    /** Display containing the normal window. */
    readonly displayId: string;
    /** Horizontal desktop coordinate. */
    readonly x: number;
    /** Vertical desktop coordinate. */
    readonly y: number;
    /** Last width, when recorded by a version supporting size memory. */
    readonly width?: number;
    /** Last height. */
    readonly height?: number;
    /** Refit the entire work area, including when the display has disappeared. */
    readonly fillsWorkArea?: boolean;
}

/** Default app size and monitor policy. */
export const DEFAULT_APP_WINDOW: AppWindowPreference = {
    /** The preset value. */
    preset: '1280x720',
    /** The width value. */
    width: 1280,
    /** The height value. */
    height: 720,
    /** The monitor value. */
    monitor: 'last-position',
};

/** Rejects malformed values and clamps both manual dimensions. */
export function validateAppWindow(value: unknown): AppWindowPreference {
    const candidate = (
        value && typeof value === 'object' ? value : {}
    ) as Partial<AppWindowPreference>;
    const preset = APP_WINDOW_SIZE_PRESETS.find(
        (size) => `${size.width}x${size.height}` === candidate.preset,
    );
    const monitor =
        candidate.monitor === 'primary' ||
        candidate.monitor === 'display' ||
        candidate.monitor === 'last-display'
            ? candidate.monitor
            : 'last-position';
    return {
        /** The preset value. */
        preset: preset
            ? `${preset.width}x${preset.height}`
            : candidate.preset === 'maximum'
              ? 'maximum'
              : candidate.preset === undefined
                ? DEFAULT_APP_WINDOW.preset
                : 'custom',
        /** Size memory is explicitly enabled. */
        rememberSize: candidate.rememberSize === true,
        /** The width value. */
        width: clampDimension(
            candidate.width,
            DEFAULT_APP_WINDOW.width,
            APP_WINDOW_SIZE_LIMITS.minWidth,
            APP_WINDOW_SIZE_LIMITS.maxWidth,
        ),
        /** The height value. */
        height: clampDimension(
            candidate.height,
            DEFAULT_APP_WINDOW.height,
            APP_WINDOW_SIZE_LIMITS.minHeight,
            APP_WINDOW_SIZE_LIMITS.maxHeight,
        ),
        /** The monitor value. */
        monitor:
            monitor === 'display' &&
            !(
                typeof candidate.displayId === 'string' &&
                candidate.displayId.trim()
            )
                ? 'primary'
                : monitor,
        ...(typeof candidate.displayId === 'string' &&
        candidate.displayId.trim()
            ? { displayId: candidate.displayId }
            : {}),
    };
}

/** Validates persisted placement without rejecting negative multi-monitor coordinates. */
export function validateAppWindowLastPosition(
    value: unknown,
): AppWindowLastPosition | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as Partial<AppWindowLastPosition>;
    if (
        typeof candidate.displayId !== 'string' ||
        !candidate.displayId.trim() ||
        typeof candidate.x !== 'number' ||
        !Number.isFinite(candidate.x) ||
        typeof candidate.y !== 'number' ||
        !Number.isFinite(candidate.y)
    )
        return undefined;
    return {
        /** The display ID value. */
        displayId: candidate.displayId,
        /** The x value. */
        x: Math.round(candidate.x),
        /** The y value. */
        y: Math.round(candidate.y),
        ...(typeof candidate.width === 'number' &&
        Number.isFinite(candidate.width) &&
        candidate.width > 0 &&
        typeof candidate.height === 'number' &&
        Number.isFinite(candidate.height) &&
        candidate.height > 0
            ? {
                  width: Math.round(candidate.width),
                  height: Math.round(candidate.height),
                  fillsWorkArea: candidate.fillsWorkArea === true,
              }
            : {}),
    };
}

/** Minimal display geometry shared by startup placement and its tests. */
export interface AppWindowDisplay {
    /** Native display identifier. */
    readonly id: string | number;
    /** Usable desktop rectangle, excluding the taskbar or dock. */
    readonly workArea: {
        /** The x value. */
        x: number;
        /** The y value. */
        y: number;
        /** The width value. */
        width: number;
        /** The height value. */
        height: number;
    };
}

/** Restores a visible startup window, falling back to the primary monitor. */
export function resolveAppWindowBounds(
    preference: AppWindowPreference,
    lastPosition: AppWindowLastPosition | undefined,
    displays: readonly AppWindowDisplay[],
    primary: AppWindowDisplay,
): {
    /** The x value. */
    x: number;
    /** The y value. */
    y: number;
    /** The width value. */
    width: number;
    /** The height value. */
    height: number;
} {
    const value = validateAppWindow(preference);
    const display = resolveAppWindowDisplay(
        value,
        lastPosition,
        displays,
        primary,
    );
    const area = display.workArea;
    const rememberedSize =
        value.rememberSize && lastPosition?.width && lastPosition.height
            ? lastPosition.fillsWorkArea
                ? area
                : lastPosition
            : undefined;
    const size =
        value.preset === 'maximum' && !rememberedSize
            ? area
            : (rememberedSize ??
              APP_WINDOW_SIZE_PRESETS.find(
                  (item) => `${item.width}x${item.height}` === value.preset,
              ) ??
              value);
    const width = Math.max(
        APP_WINDOW_SIZE_LIMITS.minWidth,
        Math.min(size.width ?? value.width, area.width),
    );
    const height = Math.max(
        APP_WINDOW_SIZE_LIMITS.minHeight,
        Math.min(size.height ?? value.height, area.height),
    );
    const restore =
        value.monitor === 'last-position' &&
        lastPosition?.displayId === String(display.id);
    const x = restore ? lastPosition.x : area.x + (area.width - width) / 2;
    const y = restore ? lastPosition.y : area.y + (area.height - height) / 2;
    return {
        /** The width value. */
        width,
        /** The height value. */
        height,
        /** The x value. */
        x: Math.round(
            Math.max(area.x, Math.min(x, area.x + area.width - width)),
        ),
        /** The y value. */
        y: Math.round(
            Math.max(area.y, Math.min(y, area.y + area.height - height)),
        ),
    };
}

/** Resolves the same target monitor in the renderer, save handler and startup. */
export function resolveAppWindowDisplay<T extends AppWindowDisplay>(
    preference: AppWindowPreference,
    lastPosition: AppWindowLastPosition | undefined,
    displays: readonly T[],
    primary: T,
): T {
    const wantedId =
        preference.monitor === 'display'
            ? preference.displayId
            : preference.monitor === 'last-position' ||
                preference.monitor === 'last-display'
              ? lastPosition?.displayId
              : undefined;
    return (
        displays.find((display) => String(display.id) === wantedId) ?? primary
    );
}

/** Computes input limits from the OS work area in logical pixels. */
export function getAppWindowSizeLimits(display: AppWindowDisplay) {
    return {
        /** The min width value. */
        minWidth: APP_WINDOW_SIZE_LIMITS.minWidth,
        /** The min height value. */
        minHeight: APP_WINDOW_SIZE_LIMITS.minHeight,
        /** The max width value. */
        maxWidth: Math.max(
            APP_WINDOW_SIZE_LIMITS.minWidth,
            Math.floor(display.workArea.width),
        ),
        /** The max height value. */
        maxHeight: Math.max(
            APP_WINDOW_SIZE_LIMITS.minHeight,
            Math.floor(display.workArea.height),
        ),
    };
}

/** Normalizes a saved or displayed preset against the current monitor topology. */
export function fitAppWindowPreference(
    preference: AppWindowPreference,
    display: AppWindowDisplay,
): AppWindowPreference {
    const value = validateAppWindow(preference);
    const limits = getAppWindowSizeLimits(display);
    const size =
        value.preset === 'maximum'
            ? display.workArea
            : (APP_WINDOW_SIZE_PRESETS.find(
                  (size) => `${size.width}x${size.height}` === value.preset,
              ) ?? value);
    const width = clampDimension(
        size.width,
        DEFAULT_APP_WINDOW.width,
        limits.minWidth,
        limits.maxWidth,
    );
    const height = clampDimension(
        size.height,
        DEFAULT_APP_WINDOW.height,
        limits.minHeight,
        limits.maxHeight,
    );
    return {
        ...value,
        /** The width value. */
        width,
        /** The height value. */
        height,
        /** The preset value. */
        preset:
            width === size.width && height === size.height
                ? value.preset
                : 'custom',
    };
}

/** Uses a finite rounded dimension within the shared limits. */
function clampDimension(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.round(value)))
        : fallback;
}
