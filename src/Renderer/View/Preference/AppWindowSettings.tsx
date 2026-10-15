import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckBox, Select, Stack, Text } from '@kawaikara/kawai-ui';
import type {
    AppMessages,
    DisplayInfo,
    PreferencePatch,
    PreferenceState,
} from '../../../Common/IPC';
import {
    APP_WINDOW_SIZE_LIMITS,
    APP_WINDOW_SIZE_PRESETS,
    DEFAULT_APP_WINDOW,
    validateAppWindow,
    resolveAppWindowDisplay,
} from '../../../Common/AppWindow';
import { NumberInput } from './NumberInput';

/** Startup-only app window controls above the independent PiP settings. */
export function AppWindowSettings({
    displays,
    messages,
    preferences,
    saving,
    onUpdate,
}: {
    /** Available monitors in native display order. */
    readonly displays: readonly DisplayInfo[];
    /** Localized application labels. */
    readonly messages: AppMessages;
    /** Current editable preferences. */
    readonly preferences: PreferenceState;
    /** Prevent editing while applying preferences. */
    readonly saving: boolean;
    /** Updates the existing preference draft. */
    readonly onUpdate: (patch: PreferencePatch) => void;
}) {
    const rawValue = preferences.appWindow ?? DEFAULT_APP_WINDOW;
    const screens = displays.map((display) => ({
        ...display,
        workArea: display.workArea ?? {
            x: 0,
            y: 0,
            width: display.width,
            height: display.height,
        },
    }));
    const primary = screens.find((display) => display.primary) ?? screens[0];
    const target = primary
        ? resolveAppWindowDisplay(
              rawValue,
              preferences.appWindowLastPosition,
              screens,
              primary,
          )
        : undefined;
    const availablePresets = APP_WINDOW_SIZE_PRESETS.filter((size) =>
        screens.some(
            (display) =>
                size.width <= display.workArea.width &&
                size.height <= display.workArea.height,
        ),
    );
    const maxWidth = Math.max(
        APP_WINDOW_SIZE_LIMITS.minWidth,
        ...screens.map((display) => display.workArea.width),
    );
    const maxHeight = Math.max(
        APP_WINDOW_SIZE_LIMITS.minHeight,
        ...screens.map((display) => display.workArea.height),
    );
    const value = {
        ...rawValue,
        width: Math.min(maxWidth, rawValue.width),
        height: Math.min(maxHeight, rawValue.height),
        preset:
            rawValue.preset === 'custom' ||
            rawValue.preset === 'maximum' ||
            availablePresets.some(
                (size) => `${size.width}x${size.height}` === rawValue.preset,
            )
                ? rawValue.preset
                : 'custom',
    };
    const labels = messages.appWindow;
    const reducedMotion = useReducedMotion();
    const selectedMonitor =
        value.monitor === 'display'
            ? `display:${value.displayId}`
            : value.monitor;
    const monitorOptions = [
        { value: 'last-position', label: labels.lastPosition },
        { value: 'last-display', label: labels.lastDisplay },
        { value: 'primary', label: labels.primary },
        ...displays.map((display, index) => ({
            value: `display:${display.id}`,
            label: `${labels.display} ${index + 1} · ${display.label} · ${display.width} × ${display.height}`,
        })),
    ];
    if (!monitorOptions.some((option) => option.value === selectedMonitor)) {
        monitorOptions.push({
            value: selectedMonitor,
            label: labels.unavailable,
        });
    }
    return (
        <section className="app-window-settings">
            <Text className="preference-section-title" weight="semibold">
                {labels.title}
            </Text>
            <Stack gap="sm">
                <Select
                    disabled={saving}
                    label={labels.monitor}
                    description={labels.description}
                    options={monitorOptions}
                    value={selectedMonitor}
                    onValueChange={(monitor) =>
                        onUpdate({
                            appWindow: validateAppWindow({
                                ...value,
                                monitor: monitor.startsWith('display:')
                                    ? 'display'
                                    : monitor,
                                displayId: monitor.startsWith('display:')
                                    ? monitor.slice(8)
                                    : undefined,
                            }),
                        })
                    }
                />
                <Select
                    disabled={saving || value.rememberSize}
                    label={labels.size}
                    value={value.preset}
                    options={[
                        ...availablePresets.map((size) => ({
                            value: `${size.width}x${size.height}`,
                            label: `${size.width} × ${size.height}`,
                        })),
                        {
                            value: 'maximum',
                            label: `${labels.maximum}${target ? ` · ${target.workArea.width} × ${target.workArea.height}` : ''}`,
                        },
                        { value: 'custom', label: labels.manual },
                    ]}
                    onValueChange={(preset) => {
                        const size = APP_WINDOW_SIZE_PRESETS.find(
                            (size) => `${size.width}x${size.height}` === preset,
                        );
                        onUpdate({
                            appWindow: validateAppWindow({
                                ...value,
                                ...size,
                                preset,
                            }),
                        });
                    }}
                />
                <CheckBox
                    value="remember-window-size"
                    checked={value.rememberSize === true}
                    disabled={saving}
                    label={labels.rememberSize}
                    description={labels.rememberSizeDescription}
                    onChange={(event) =>
                        onUpdate({
                            appWindow: validateAppWindow({
                                ...value,
                                rememberSize: event.target.checked,
                            }),
                        })
                    }
                />
                <AnimatePresence initial={false}>
                    {value.preset === 'custom' && !value.rememberSize && (
                        <motion.div
                            className="pip-custom-size-fields"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reducedMotion ? 0 : 0.2 }}>
                            <div className="app-window-custom-size-grid">
                                <NumberInput
                                    containerClassName="pip-dimension-field"
                                    disabled={saving}
                                    label={messages.pipWidth}
                                    layout="inline"
                                    live
                                    min={APP_WINDOW_SIZE_LIMITS.minWidth}
                                    max={maxWidth}
                                    step={1}
                                    unit={messages.pixels}
                                    value={value.width}
                                    onValueChange={(width) =>
                                        onUpdate({
                                            appWindow: validateAppWindow({
                                                ...value,
                                                width,
                                            }),
                                        })
                                    }
                                />
                                <NumberInput
                                    containerClassName="pip-dimension-field"
                                    disabled={saving}
                                    label={messages.pipHeight}
                                    layout="inline"
                                    live
                                    min={APP_WINDOW_SIZE_LIMITS.minHeight}
                                    max={maxHeight}
                                    step={1}
                                    unit={messages.pixels}
                                    value={value.height}
                                    onValueChange={(height) =>
                                        onUpdate({
                                            appWindow: validateAppWindow({
                                                ...value,
                                                height,
                                            }),
                                        })
                                    }
                                />
                            </div>
                            <Text tone="muted" size="sm">
                                {labels.limits
                                    .replace('{width}', String(maxWidth))
                                    .replace('{height}', String(maxHeight))}
                            </Text>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Stack>
        </section>
    );
}
