"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var material_1 = require("@mui/material");
var Typography_1 = __importDefault(require("@mui/material/Typography"));
var Box_1 = __importDefault(require("@mui/material/Box"));
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
var Switch_1 = __importDefault(require("./Switch"));
var AutoCompleteSelector_1 = __importDefault(require("./AutoCompleteSelector"));
var definition_1 = require("./definition");
function GeneralPreference() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
    var _7 = (0, definition_1.useCurConfigureStore)(function (state) { return [state.set_property, state.get_property]; }), set_property = _7[0], get_property = _7[1];
    var f = function (value) {
        var _a = value.split("x").map(function (v) { return Number(v); }), width = _a[0], height = _a[1];
        set_property("configure.general.pip_location.preset_location_list.width", width);
        set_property("configure.general.pip_location.preset_location_list.height", height);
    };
    return (<Box_1.default>
        <Typography_1.default fontSize={32}>{(_a = get_property("configure.general")) === null || _a === void 0 ? void 0 : _a.name}</Typography_1.default>
        <material_1.Grid container style={{ maxHeight: '80%', overflow: 'auto' }} justifyContent="center" rowGap={1} spacing={1}>
            {/* <KawaiSwitch onclick={(e)=>{ set_property("configure.general.pip_mode", e) }}
            id = {get_property("configure.general.pip_mode")?.id as string}
            title={get_property("configure.general.pip_mode")?.name as string}
            defaultchecked = { get_property("configure.general.pip_mode")?.item as boolean}/> */}
            {/* <KawaiAutoCompleteSelector
        id ={get_property("configure.general.locales")?.id as string}
        title={get_property("configure.general.locales")?.name as string}
        preset_list={get_property("configure.general.locales.locale_preset")?.item as string[] ?? []}
        get_default_value={get_property("configure.general.locales.selected_locale.locale_native_name")?.item as string ?? ""}
        select_f={(text : string)=>{ set_property("configure.general.locales.locale_native_name", text)}}
        />
        <KawaiAutoCompleteSelector
            id ={get_property("configure.general.default_main.default_main")?.id as string}
            title={get_property("configure.general.default_main")?.name as string}
            preset_list={get_property("configure.general.default_main.default_main_page_preset")?.item as string[] ?? []}
            get_default_value={get_property("configure.general.default_main_id")?.item as string ?? ""}
            select_f={(text : string)=>{ set_property("configure.general.default_main_id", text)}}
            /> */}
            <AutoCompleteSelector_1.default id={(_b = get_property("configure.general.pip_location.location")) === null || _b === void 0 ? void 0 : _b.id} title={(_c = get_property("configure.general.pip_location.location")) === null || _c === void 0 ? void 0 : _c.name} preset_list={(_e = (_d = get_property("configure.general.pip_location.preset_location_list")) === null || _d === void 0 ? void 0 : _d.item) !== null && _e !== void 0 ? _e : []} get_default_value={(_g = (_f = get_property("configure.general.pip_location.location")) === null || _f === void 0 ? void 0 : _f.item) !== null && _g !== void 0 ? _g : "bottom-left"} select_f={function (text) { set_property("configure.general.pip_location.location", text); }}/>
                <AutoCompleteSelector_1.default id={(_h = get_property("configure.general.pip_location.monitor")) === null || _h === void 0 ? void 0 : _h.id} title={(_j = get_property("configure.general.pip_location.monitor")) === null || _j === void 0 ? void 0 : _j.name} preset_list={(_l = (_k = get_property("configure.general.pip_location.preset_monitor_list")) === null || _k === void 0 ? void 0 : _k.item) !== null && _l !== void 0 ? _l : ["0", "1"]} get_default_value={(_o = (_m = get_property("configure.general.pip_location.monitor")) === null || _m === void 0 ? void 0 : _m.item) !== null && _o !== void 0 ? _o : "0"} select_f={function (text) { set_property("configure.general.pip_location.monitor", text); }}/>
                <AutoCompleteSelector_1.default id={(_p = get_property("configure.general.pip_window_size")) === null || _p === void 0 ? void 0 : _p.id} title={(_q = get_property("configure.general.pip_window_size")) === null || _q === void 0 ? void 0 : _q.name} preset_list={(_s = (_r = get_property("configure.general.pip_window_size.preset_list")) === null || _r === void 0 ? void 0 : _r.item) !== null && _s !== void 0 ? _s : []} get_default_value={(((_t = get_property("configure.general.pip_window_size.width")) === null || _t === void 0 ? void 0 : _t.item) + "x"
            + ((_u = get_property("configure.general.pip_window_size.height")) === null || _u === void 0 ? void 0 : _u.item))} select_f={function (text) {
            var _a = text.split("x").map(function (v) { return Number(v); }), width = _a[0], height = _a[1];
            set_property("configure.general.pip_window_size.width", width);
            set_property("configure.general.pip_window_size.height", height);
        }} onselected_customize_f={function (index, size) {
            if (index === 0)
                set_property("configure.general.pip_window_size.width", size);
            else
                set_property("configure.general.pip_window_size.height", size);
        }} additional_textedit={true}/>

            {/* <KawaiAutoCompleteSelector
            id ={get_property("configure.general.default_main")?.id as string}
            title={get_property("configure.general.default_main")?.name as string}
            values={["1"]}/> */}


            <AutoCompleteSelector_1.default id={(_v = get_property("configure.general.window_size")) === null || _v === void 0 ? void 0 : _v.id} title={(_w = get_property("configure.general.window_size")) === null || _w === void 0 ? void 0 : _w.name} preset_list={(_y = (_x = get_property("configure.general.window_size.preset_list")) === null || _x === void 0 ? void 0 : _x.item) !== null && _y !== void 0 ? _y : [""]} get_default_value={(((_z = get_property("configure.general.window_size.width")) === null || _z === void 0 ? void 0 : _z.item) + "x"
            + ((_0 = get_property("configure.general.window_size.height")) === null || _0 === void 0 ? void 0 : _0.item))} select_f={function (text) {
            var _a = text.split("x").map(function (v) { return Number(v); }), width = _a[0], height = _a[1];
            set_property("configure.general.window_size.width", width);
            set_property("configure.general.window_size.height", height);
        }} onselected_customize_f={function (index, size) {
            if (index === 0)
                set_property("configure.general.window_size.width", size);
            else
                set_property("configure.general.window_size.height", size);
        }} additional_textedit={true}/>

            {/* <KawaiSwitch
            id = { get_property("configure.general.render_full_size_when_pip_running")?.id as string}
            title={get_property("configure.general.render_full_size_when_pip_running")?.name as string}
            onclick={(e)=>{ set_property("configure.general.render_full_size_when_pip_running", !(get_property("configure.general.render_full_size_when_pip_running")?.item as boolean)) }}
            defaultchecked = {get_property("configure.general.render_full_size_when_pip_running")?.item as boolean}
            /> */}

            <Switch_1.default id={(_1 = get_property("configure.general.enable_autoupdate")) === null || _1 === void 0 ? void 0 : _1.id} title={(_2 = get_property("configure.general.enable_autoupdate")) === null || _2 === void 0 ? void 0 : _2.name} onclick={function (e) { set_property("configure.general.enable_autoupdate", e); }} defaultchecked={(_3 = get_property("configure.general.enable_autoupdate")) === null || _3 === void 0 ? void 0 : _3.item}/>

            <Switch_1.default id={(_4 = get_property("configure.general.dark_mode")) === null || _4 === void 0 ? void 0 : _4.id} title={(_5 = get_property("configure.general.dark_mode")) === null || _5 === void 0 ? void 0 : _5.name} onclick={function (e) { set_property("configure.general.dark_mode", e); }} defaultchecked={(_6 = get_property("configure.general.dark_mode")) === null || _6 === void 0 ? void 0 : _6.item}/>
        </material_1.Grid>
        </Box_1.default>);
}
exports.default = GeneralPreference;
//# sourceMappingURL=GeneralPreferences.js.map