import React, { MouseEventHandler, useEffect } from 'react';
import ShortcutTextField from './ShortcutTextfield';
import { Box, Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { config_states, shortcut_states } from './definition';
import { KawaiShortcut } from '../../typescript_src/definitions/setting_types';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
};

const rawstack_style = {
    textAlign: 'center',
};
function ShortcutPreference() {
    // const save_checker = save_flag((state)=>state.check_duplication_shortcut)
    const [set_property, get_property] = config_states((state) => [
        state.set_property,
        state.get_property,
    ]);
    const [ dupcheck] = shortcut_states((state) => [
        state.check_duplication
    ]);

  
    // const dup_check_f = (ignore_key: string, text: string) => {
    //     const shortcut = get_property().shortcut;
    //     console.log(`shorutcut prop : ${shortcut}`);
    //     console.log(ignore_key);
    //     if (typeof shortcut !== 'undefined') {
    //         console.log('test insert');
    //         let keys = Object.keys(shortcut);
    //         console.log('keys', keys);
    //         keys = keys.filter((v) => {
    //             return v !== 'name' && v !== ignore_key;
    //         });
    //         console.log('keys', keys);
    //         let shortcut_list = keys.map((k: string) => {
    //             const shortcut_string =
    //                 (shortcut[k] as KawaiShortcut).shortcut_key ?? '';
    //             return shortcut_string;
    //         });
    //         shortcut_list = shortcut_list.filter((v) => v !== ''); // remove empty string
    //         if (new Set<string>(shortcut_list).has(text)) {
    //             console.log('t', shortcut_list);
    //             return true;
    //         } else {
    //             // console.log("f", shortcut_list)
    //             return false;
    //         }
    //     }
    // };

    let root_id: string = 'shortcut';
    let shortcut_list = get_property()!.shortcut!;
    let render_list: JSX.Element[] = [];

    Object.entries(shortcut_list).forEach(([key, value]) => {
        if (key === 'name')
            // we don't need name prop.
            return;

        const id: string = root_id + '.' + key;
        render_list.push(
            <Grid container sx={rawstack_style} rowGap={1} spacing={1}>
                <Grid container sx={rawstack_style} spacing={12}>
                    {' '}
                </Grid>
                <Grid item xs={6}>
                    {' '}
                    <Typography>
                        {(value as KawaiShortcut).name ?? key}
                    </Typography>{' '}
                </Grid>
                <Grid item xs={6}>
                    <ShortcutTextField
                        id={id}
                        get_shortcut_f={() => {
                            const item = get_property()?.shortcut;
                            if (typeof item === 'undefined') return '';
                            return (
                                (item[key] as KawaiShortcut).shortcut_key ?? ''
                            );
                        }}
                        set_shortcut_f={(e: string) => {
                            set_property(`${id}.shortcut_key`, e);
                            console.log('set props');
                        }}
                        // duplication_check_f={dup_check_f.bind(null, key)}
                        dup_check={dupcheck(key)}
                    />
                </Grid>
            </Grid>,
        );
    });

    return (
        <Box>
            <Typography fontWeight={'medium'} fontSize={32}>
                {shortcut_list?.name}
            </Typography>
            {render_list}
        </Box>
    );
}

export default ShortcutPreference;
