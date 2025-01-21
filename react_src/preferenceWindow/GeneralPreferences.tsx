import React, { MouseEventHandler, useEffect } from 'react';
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import WindowSizeComponent from './WindowSizeComponent';
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';

// see also

// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
import KawaiSwitch from './Switch';
import KawaiAutoCompleteSelector from './AutoCompleteSelector';
import { config_states, preset_data } from './definition';
import {
    KawaiConfig,
    KawaiPreference,
} from '../../typescript_src/definitions/setting_types';
import { create } from 'zustand';
import KawaiSelector from './KawaiSelector';

function GeneralPreference() {
    const [set_property, get_property] = config_states((state) => [
        state.set_property,
        state.get_property,
    ]);

    const [
        preset_fetch,
        available_locale_list,
        available_monitor_list,
        available_site_list,
        available_window_size_list,
        available_pip_window_size_list,
        available_pip_location_list,
    ] = preset_data((state) => [
        state.fetch,
        state.available_locale_list,
        state.available_monitor_list,
        state.available_site_list,
        state.available_window_size_list,
        state.available_pip_window_size_list,
        state.available_pip_location_list,
    ]);
    useEffect(() => {
        preset_fetch().then(() => {
            console.log('fetched');
        });
    }, []);
    // const f = (value : string)=>{
    //     const [width, height] = value.split("x").map((v)=>Number(v))
    //     set_property("configure.general.pip_location.preset_location_list.width", width)
    //     set_property("configure.general.pip_location.preset_location_list.height", height)

    // }

    return (
        <Box>
            <Typography fontSize={32}>
                {' '}
                {get_property().general?.name ?? 'General'}{' '}
            </Typography>
            <Grid
                container
                style={{ maxHeight: '80%', overflow: 'auto' }}
                justifyContent="center"
                rowGap={1}
                spacing={1}>
                <KawaiSelector
                    id={'general.pip_location.location'}
                    title={
                        get_property().general?.window_preference?.pip_location
                            ?.location?.name ?? 'PiP Location'
                    }
                    preset_list={available_pip_location_list}
                    value={
                        get_property().general?.window_preference?.pip_location
                            ?.location?.value ?? 'top-right'
                    }
                    select_f={(text: string) => {
                        set_property(
                            'general.window_preference.pip_location.location.value',
                            text,
                        );
                    }}
                />
                <KawaiSelector
                    id={'general.window_preference.pip_location.monitor'}
                    title={
                        get_property().general?.window_preference?.pip_location
                            ?.monitor?.name ?? 'PiP Monitor'
                    }
                    preset_list={available_monitor_list}
                    value={
                        get_property()?.general?.window_preference?.pip_location
                            ?.monitor?.value ?? ""
                    }
                    select_f={(text: string) => {
                        set_property(
                            'general.window_preference.pip_location.monitor.value',
                            text,
                        );
                    }}
                />
                <KawaiAutoCompleteSelector
                    id={'general.window_preference.pip_window_size'}
                    title={
                        get_property()?.general?.window_preference
                            ?.pip_window_size?.name ?? 'PiP Window Size'
                    }
                    preset_list={available_window_size_list.map((value) => {
                        const [width, height]: number[] = value;
                        return width.toString() + 'x' + height.toString();
                    })}
                    value={
                        (get_property().general?.window_preference?.pip_window_size?.width?.value?.toString() ??
                            '0') +
                        'x' +
                        (get_property().general?.window_preference?.pip_window_size?.height?.value?.toString() ??
                            '0')
                    }
                    select_f={(text: string) => {
                        const [width, height] = text
                            .split('x')
                            .map((v) => Number(v));

                        set_property(
                            'general.window_preference.pip_window_size.width.value',
                            width,
                        );
                        set_property(
                            'general.window_preference.pip_window_size.height.value',
                            height,
                        );
                    }}
                    onselected_customize_f={(index: number, size: number) => {
                        if (index === 0)
                            set_property(
                                'general.window_preference.pip_window_size.width.value',
                                size,
                            );
                        else
                            set_property(
                                'general.window_preference.pip_window_size.height.value',
                                size,
                            );
                    }}
                />
                <KawaiAutoCompleteSelector
                    id={'general.window_preference.window_size'}
                    title={
                        get_property().general?.window_preference?.window_size
                            ?.name ?? 'Window Size'
                    }
                    preset_list={available_window_size_list.map((value) => {
                        const [width, height]: number[] = value;
                        return width.toString() + 'x' + height.toString();
                    })}
                    value={
                        (get_property()?.general?.window_preference?.window_size?.width?.value?.toString() ??
                            '0') +
                        'x' +
                        (get_property()?.general?.window_preference?.window_size?.height?.value?.toString() ??
                            '0')
                    }
                    select_f={(text: string) => {
                        const [width, height] = text
                            .split('x')
                            .map((v) => Number(v));
                        set_property(
                            'general.window_preference.window_size.width.value',
                            width,
                        );
                        set_property(
                            'general.window_preference.window_size.height.value',
                            height,
                        );
                    }}
                    onselected_customize_f={(index: number, size: number) => {
                        console.log("size?",size)
                        if (index === 0)
                            set_property(
                                'general.window_preference.window_size.width.value',
                                size,
                            );
                        else
                            set_property(
                                'general.window_preference.window_size.height.value',
                                size,
                            );
                    }}
                />

                <KawaiSwitch
                    id={'general.enable_autoupdate.name'}
                    title={
                        get_property().general?.enable_autoupdate?.name ??
                        'Enable Autoupdate'
                    }
                    onclick={(e) => {
                        set_property('general.enable_autoupdate.value', e);
                    }}
                    defaultchecked={
                        (get_property().general?.enable_autoupdate
                            ?.value as boolean) ?? false
                    }
                />

                <KawaiSwitch
                    id={'general.dark_mode.name'}
                    title={
                        (get_property().general?.dark_mode?.name as string) ??
                        'Enable Dark Mode'
                    }
                    onclick={(e) => {
                        set_property('general.dark_mode.value', e);
                    }}
                    defaultchecked={
                        get_property().general?.dark_mode?.value ?? false
                    }
                />
            </Grid>
        </Box>
    );
}

export default GeneralPreference;
