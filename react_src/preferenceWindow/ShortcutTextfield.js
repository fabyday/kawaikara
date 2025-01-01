"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importStar(require("react"));
var TextField_1 = __importDefault(require("@mui/material/TextField"));
var definition_1 = require("./definition");
var lodash_1 = __importDefault(require("lodash"));
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function ShortcutTextField(_a) {
    var id = _a.id, get_shortcut_f = _a.get_shortcut_f, set_shortcut_f = _a.set_shortcut_f, duplication_check_f = _a.duplication_check_f;
    var _b = react_1.default.useState(false), isError = _b[0], setError = _b[1];
    var _c = react_1.default.useState(""), helptext = _c[0], setHelpText = _c[1];
    var helper_text = "Duplication Error";
    var _d = react_1.default.useState(false), pressing = _d[0], setPressing = _d[1];
    var _e = react_1.default.useState(new Set()), accelerator = _e[0], setAccelerator = _e[1];
    var _f = react_1.default.useState(new Set()), key = _f[0], setKey = _f[1];
    var _g = react_1.default.useState(get_shortcut_f()), combined = _g[0], setCombined = _g[1];
    var modifierKeyCodes = new Set([16, 17, 18, 91, 92, 93]);
    var specialKeyCodes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 91, 92, 93, 94, 95]);
    var shortcut_to_id_map = (0, definition_1.save_flag)(function (state) { return state.shortcut_to_id_map; });
    var t = shortcut_to_id_map.get(combined);
    (0, react_1.useEffect)(function () {
        if (typeof t !== "undefined") {
            if (t.size > 1 && (t === null || t === void 0 ? void 0 : t.has(id))) {
                setError(true);
                setHelpText(helper_text);
            }
            else if (t.size === 1 && (t === null || t === void 0 ? void 0 : t.has(id))) {
                setError(false);
                setHelpText("");
            }
        }
    });
    // const unset = save_flag.subscribe((state)=>{
    //     let t = state.shortcut_to_id_map.get(combined)
    //     if(typeof t !== "undefined"){
    //         if(t!.size >1 && t?.has(id)){
    //             setError(true)
    //             setHelpText(helper_text)
    //         }else if(t!.size === 1 && t?.has(id)){
    //             setError(false)
    //             setHelpText("")
    //         }
    //     }
    // })
    // useEffect(()=>{
    //     return unset
    // }, [])
    var key_mapper = { Control: "Ctrl", Meta: "Win", Alt: "Alt", Shift: "Shift" };
    var key_mapper_inverse = { Ctrl: "Control", Win: "Meta", Alt: "Alt", Shift: "Shift" };
    var altKeyName = 'Alt';
    var metaKeyName = 'Meta';
    if (navigator.userAgent.indexOf('Mac') !== -1) {
        altKeyName = 'Option';
        metaKeyName = 'Command';
    }
    else if (navigator.userAgent.indexOf('Win') !== -1) {
        metaKeyName = 'Windows';
    }
    var handleKeyDown = function (event) {
        event.preventDefault();
        if (!pressing) {
            setPressing(true);
            setKey(new Set());
            setAccelerator(new Set());
        }
        // Clear the value on backspace (8) or delete (46)
        if ((event.which === 8 || event.which === 46))
            return;
        var res_key = "";
        if (modifierKeyCodes.has(event.keyCode)) {
            if (!accelerator.has(event.key)) {
                var name_1 = event.key;
                accelerator.add(key_mapper[name_1]);
                setAccelerator(accelerator);
            }
        }
        else {
            if (!key.has(event.key.toUpperCase()) && accelerator.size !== 0) {
                key.add(event.key.toUpperCase());
                setKey(key);
            }
            // else{
            //     console.log("oug")
            //     setKey([])
            // }
        }
        var f = function (v) {
            if (res_key.length === 0)
                res_key += v;
            else
                res_key += "+" + v;
        };
        accelerator.forEach(f);
        key.forEach(f);
        setCombined(res_key);
    };
    var handleKeyUp = function (event) {
        console.log(event);
        event.preventDefault();
        if (modifierKeyCodes.has(event.keyCode)) {
            var key_1 = key_mapper[event.key];
            if (accelerator.has(key_1)) {
                accelerator.delete(key_1);
                setAccelerator(lodash_1.default.cloneDeep(accelerator));
            }
        }
        else {
            if (key.has(event.key.toUpperCase())) {
                key.delete(event.key.toUpperCase());
                setKey(lodash_1.default.cloneDeep(key));
            }
        }
        if (key.size === 0 && accelerator.size === 0) {
            setPressing(false);
        }
    };
    var handleOnclick = function (e) {
    };
    return (<TextField_1.default id="shortcut" onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={function (e) {
            handleOnclick(e);
        }} onBlur={function (e) {
            if (duplication_check_f(e.target.value)) {
                setError(false);
                set_shortcut_f(e.target.value);
                setHelpText("");
            }
            else {
                setError(true);
                set_shortcut_f(e.target.value);
                setHelpText(helper_text);
            }
        }} helperText={helptext} value={combined} error={isError} inputProps={{ style: { textAlign: 'center', caretColor: "transparent" } }}/>);
}
exports.default = ShortcutTextField;
//# sourceMappingURL=ShortcutTextfield.js.map