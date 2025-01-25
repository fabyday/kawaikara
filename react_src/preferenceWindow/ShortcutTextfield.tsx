import React, { MouseEventHandler, useEffect, useRef } from 'react';
import TextField from '@mui/material/TextField';
import log from 'electron-log/renderer';
import lodash from 'lodash';
// import { KawaiPreference } from '../../typescript_src/definitions/setting_types';
import {
    priority,
    ModifierKeyMap,
    ReverseModifierKeyMap,
    convertKawaiKeyCode,
} from '../../typescript_src/definitions/keyboard';
import { normalize_action_string } from '../../typescript_src/definitions/action';
type props = {
    id: string;
    get_shortcut_f: Function;
    set_shortcut_f: Function;
    // dup_check : Function;
    dup_check: boolean;
};

const kawai_modifier_set = new Set<string>(ReverseModifierKeyMap.keys());
const ignore_set = new Set<string>(['lalt+tab', 'lalt+f4', 'lalt+enter']);
/**
 *
 * @param param0
 * @returns
 */
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
// function ShortcutTextField({id,get_shortcut_f, set_shortcut_f, duplication_check_f}:props){
function ShortcutTextField({
    id,
    get_shortcut_f,
    set_shortcut_f,
    dup_check,
}: props) {
    const helper_text = 'Duplication Error';

    const [pressing, setPressing] = React.useState(false);
    const [accelerator, setAccelerator] = React.useState<Set<string>>(
        new Set<string>(),
    );
    const [key, setKey] = React.useState<Set<string>>(new Set<string>());

    // const [combined, setCombined] = React.useState<string>(get_shortcut_f());
    const [combined, setCombined] = React.useState<string>('');

    const textFieldRef = useRef<HTMLInputElement>(null); // TextField의 내부 input에 대한 ref
    const ignore_flag = useRef<boolean>(false);
    const handleKeyDown = (event: React.KeyboardEvent) => {
        event.preventDefault();
        log.info('ooooo', combined);
        if (ignore_flag.current) {
            log.info('ingore floag on!!!!');
            setPressing(true);
            setKey(new Set<string>());
            setAccelerator(new Set<string>());
        }

        if (!pressing) {
            setPressing(true);
            setKey(new Set<string>());
            setAccelerator(new Set<string>());
        }

        const kawaikey = convertKawaiKeyCode({
            key: event.key,
            code: event.code,
            altKey: true,
            ctrlKey: true,
            metaKey: true,
            shiftKey: true,
        });

        // Clear the value on backspace (8) or delete (46)
        // if (event.which === 8 || event.which === 46) return;
        if (kawaikey === 'esc') {
            setPressing(true);
            setKey(new Set<string>());
            setAccelerator(new Set<string>());
        }
        let res_key = '';
        if (kawai_modifier_set.has(kawaikey)) {
            if (!accelerator!.has(kawaikey)) {
                accelerator!.add(kawaikey);
                setAccelerator(accelerator);
            }
        } else {
            if (!key.has(kawaikey) && accelerator!.size !== 0) {
                key.add(kawaikey);
                setKey(key);
            }
        }

        const f = (v: string) => {
            if (res_key.length === 0) res_key += v;
            else res_key += '+' + v;
        };

        accelerator!.forEach(f);
        key.forEach(f);
        if (ignore_set.has(res_key)) {
            setCombined('');
            setKey(new Set<string>());
            setAccelerator(new Set<string>());
            setPressing(false);
            ignore_flag.current = true;
            textFieldRef.current!.value = '';
            if (textFieldRef.current) {
                textFieldRef.current.blur();
            }
            return;
        }
        setCombined(res_key);
    };

    const handleKeyUp = (event: React.KeyboardEvent) => {
        event.preventDefault();

        const kawaikey = convertKawaiKeyCode({
            key: event.key,
            code: event.code,
            altKey: true,
            ctrlKey: true,
            metaKey: true,
            shiftKey: true,
        });
        log.info('realse');
        if (kawai_modifier_set.has(kawaikey)) {
            if (accelerator!.has(kawaikey)) {
                accelerator!.delete(kawaikey);
                setAccelerator(new Set<string>(accelerator));
            }
        } else {
            if (key.has(kawaikey)) {
                key.delete(kawaikey);
                setKey(new Set<string>(key));
            }
        }

        if (key.size === 0 && accelerator!.size === 0) {
            setPressing(false);
            if (textFieldRef.current) {
                textFieldRef.current.blur();
            }
        }
    };

    const handleOnclick = (e: React.MouseEvent) => {
        ignore_flag.current = false;
        log.info('cur falg false');
    };

    return (
        <TextField
            id="shortcut"
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={(e) => {
                handleOnclick(e);
            }}
            onBlur={(e) => {
                log.info('bulr ok', textFieldRef.current?.value);
                set_shortcut_f(textFieldRef.current?.value);
            }}
            inputRef={textFieldRef}
            helperText={dup_check ? helper_text : ''}
            value={combined}
            error={dup_check}
            inputProps={{
                style: { textAlign: 'center', caretColor: 'transparent' },
            }}
        />
    );
}

export default ShortcutTextField;
