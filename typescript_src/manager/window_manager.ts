import { screen } from 'electron/main';
import { KawaiBounds } from '../definitions/setting_types';
import { BrowserWindow } from 'electron';
import { global_object } from '../data/context';

export class KawaiWindowManager {
    static __instance: KawaiWindowManager | undefined = undefined;
    static readonly preset_size = [
        [720, 576], // 480p
        [720, 480], // 576p
        [800, 600],
        [1280, 720], // 720p
        [1920, 1080], //1080p
        [3840, 2160], //4k
        [7680, 4320], // 8k
    ];

    private constructor() {}

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
        ].concat(...preset_size.slice(0, end_index));
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
