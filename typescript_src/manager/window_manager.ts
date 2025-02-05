import { screen } from 'electron/main';
import {
    KawaiBounds,
    KawaiLocationPresetProperty,
    KawaiNameProperty,
    KawaiWindowPreset,
} from '../definitions/setting_types';
import { BrowserWindow } from 'electron';
import { global_object } from '../data/context';
import { get_flogger } from '../logging/logger';
import { KawaiRecursiveTypeRemover } from '../definitions/types';
const flog = get_flogger('WindowManager', 'windowmanager', 'debug');
export class KawaiWindowManager {
    static __instance: KawaiWindowManager | undefined = undefined;
    static readonly preset_size = [
        [720, 480], // 576p
        [720, 576], // 480p
        [800, 600],
        [1280, 720], // 720p
        [1920, 1080], //1080p
        [3840, 2160], //4k
        [7680, 4320], // 8k
    ];

    private m_pip_bounds: Electron.Rectangle = {
        x: -1,
        y: -1,
        width: -1,
        height: -1,
    };
    private m_current_window_bounds: Electron.Rectangle = {
        x: -1,
        y: -1,
        width: 400,
        height: 300,
    };

    private m_default_window_size: Electron.Rectangle = {
        x: -1,
        y: -1,
        width: 1280,
        height: 720,
    };

    public setDefaultWindowSize(width?: number, height?: number) {
        if (typeof width === 'undefined' || typeof height === 'undefined') {
            return;
        }
        const { x, y } = this.findCenterCoordByBounds(width, height);
        this.m_default_window_size = {
            x: x,
            y: y,
            width: width,
            height: height,
        };
    }

    public getDefaultWindowSize() {
        return this.m_default_window_size;
    }
    /**
     *
     * @param width width selected from pipPreset
     * @param height height selected from pipPreset
     * @param pip_location location
     * @param monitor_name if monitor name wasn't given, then we select default primary monitor.
     */
    public setPiPBounds(
        width?: number,
        height?: number,
        pip_location?: KawaiWindowPreset,
        monitor_name?: string,
    ) {
        if (typeof width === 'undefined' || typeof height === 'undefined') {
            width = this.getPictureInPicturePresetSize()[0][0];
            height = this.getPictureInPicturePresetSize()[0][1];
        }

        let sel_disp: Electron.Display | null = null;
        sel_disp = screen.getPrimaryDisplay();
        screen.getAllDisplays().forEach((disp) => {
            if (disp.label === monitor_name) {
                sel_disp = disp;
            }
        });


        if (sel_disp != null) {
            const work_area = (sel_disp as Electron.Display).workAreaSize;
            const sel_bounds = (sel_disp as Electron.Display).bounds;
            const sel_x = sel_bounds.x;
            const sel_y = sel_bounds.y;
            const selected_width = sel_bounds.width;
            const selected_height = sel_bounds.height;
            this.m_current_window_bounds =
                global_object.mainWindow?.getBounds() ?? {
                    x: -1,
                    y: -1,
                    width: -1,
                    height: -1,
                };

            let left_pos_x = 0;
            let left_pos_y = 0;
            const min_padding = 2;
            switch (pip_location) {
                case 'top-left': {
                    left_pos_x = sel_x + min_padding;
                    left_pos_y = sel_y + min_padding;
                    break;
                }
                case 'top-right': {
                    left_pos_x = sel_x + selected_width - width - min_padding;
                    left_pos_y = sel_y + min_padding;
                    break;
                }
                case 'bottom-left': {
                    left_pos_x = sel_x + min_padding;
                    left_pos_y = sel_y + selected_height - height - min_padding;
                    break;
                }
                case 'bottom-right': {
                    left_pos_x = sel_x + selected_width - width - min_padding;
                    left_pos_y = sel_y + selected_height - height - min_padding;
                }
            }

            this.m_pip_bounds = {
                x: left_pos_x,
                y: left_pos_y,
                width: width,
                height: height,
            };
        }
    }

    public getPipBounds() {
        return this.m_pip_bounds;
    }

    private constructor() {
        this.setDefaultWindowSize(
            this.m_default_window_size.width,
            this.m_default_window_size.height,
        );
    }

    public static getInstance() {
        if (KawaiWindowManager.__instance === undefined) {
            KawaiWindowManager.__instance = new KawaiWindowManager();
        }
        return KawaiWindowManager.__instance;
    }

    /**
     *
     * @returns return main window preset size. it depends on biggest Monitor size that belong to your machine.
     */
    public getPresetSize() {
        const all_displays = screen.getAllDisplays();

        let max_volume = 0;
        let max_volume_index = -1;
        for (let i = 0; i < all_displays.length; i++) {
            const display = all_displays[i];
            const width = display.size.width;
            const height = display.size.height;

            const display_volume = width * height;
            if (max_volume < display_volume) {
                max_volume = display_volume;
                max_volume_index = i;
            }
        }

        const width = all_displays[max_volume_index].size.width;
        const height = all_displays[max_volume_index].size.height;

        const selected_preset = KawaiWindowManager.preset_size.filter(
            (value: number[], index: number, array: number[][]) => {
                if (value[0] < width || value[1] < height) {
                    return value;
                }
            },
        );
        const max_preset = selected_preset[selected_preset.length - 1];
        if (max_preset[0] < width && max_preset[1] < height) {
            selected_preset.push([width, height]);
        }

        return selected_preset;
    }

    public getPiPLocationCandidates(): KawaiWindowPreset[] {
        return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    }

    /**
     *
     * @returns get PiP preset size.
     */
    public getPictureInPicturePresetSize() {
        const preset_size = this.getPresetSize();
        const end_index: number | undefined =
            preset_size.length - 2 > 0 ? preset_size.length - 2 : undefined;
        const pip_preset = [
            [400, 300],
            [600, 400],
        ].concat(preset_size.slice(0, end_index));
        flog.debug(pip_preset);
        return pip_preset;
    }
    /**
     *
     * @returns get monitor names.
     */
    public getMonitorNames(): string[] {
        const display_names = screen
            .getAllDisplays()
            .map(
                (
                    value: Electron.Display,
                    index: number,
                    array: Electron.Display[],
                ) => {
                    return value.label;
                },
            );
        return display_names;
    }

    public setCofigWindowSize(
        x?: number,
        y?: number,
        width?: number,
        height?: number,
    ): void {}

    public getConfigWindowSize(): Electron.Rectangle {
        const obj: KawaiBounds | undefined =
            global_object.config?.preference?.general?.window_preference
                ?.window_size;
        var result = {};
        if (typeof obj !== 'undefined') {
            result = {
                x: obj?.x?.value ?? 0,
                y: obj?.y?.value ?? 0,
                width: obj?.width?.value ?? -1,
                height: obj?.height?.value ?? -1,
            };
        } else {
            result = { x: 0, y: 0, width: -1, height: -1 };
        }
        return result as Electron.Rectangle;
    }

    /**
     *
     * @param width : desired width
     * @param height : desired height
     * @param monitor_label : monitor label from getMonitorNames()
     * if monitor_label is undefined then we select main monitor
     */
    public findCenterCoordByBounds(
        b_width: number,
        b_height: number,
        monitor_label?: string,
    ): { x: number; y: number } {
        const new_xy_f = (moinitor_width: number, monitor_height: number) => {
            const new_x = (moinitor_width - b_width) / 2;
            const new_y = (monitor_height - b_height) / 2;
            return { x: new_x, y: new_y };
        };

        if (typeof monitor_label === 'undefined') {
            const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
            return new_xy_f(width, height);
        } else {
            const display: Electron.Display[] = screen
                .getAllDisplays()
                .filter((value: Electron.Display) => {
                    if (value.label === monitor_label) {
                        return value;
                    }
                });

            if (display.length === 0) {
                const { x, y, width, height } =
                    screen.getPrimaryDisplay().bounds;
                return new_xy_f(width, height);
            } else {
                const { x, y, width, height } =
                    display[display.length - 1].bounds;
                return new_xy_f(width, height);
            }
        }
    }
}
