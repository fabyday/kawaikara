"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var MenuItem_1 = __importDefault(require("@mui/material/MenuItem"));
var FormControl_1 = __importDefault(require("@mui/material/FormControl"));
var TextField_1 = __importDefault(require("@mui/material/TextField"));
var Select_1 = __importDefault(require("@mui/material/Select"));
var Grid_1 = __importDefault(require("@mui/material/Grid"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var react_1 = require("react");
function WindowSizeComponent(_a) {
    var id = _a.id, preset_list = _a.preset_list, get_default_value = _a.get_default_value, onSelect_f = _a.onSelect_f, onselected_customize_f = _a.onselected_customize_f, customizable = _a.customizable;
    var inputs = [];
    var flag = customizable ? true : false;
    var _b = (0, react_1.useState)(inputs), args = _b[0], set_args = _b[1];
    var _c = (0, react_1.useState)(get_default_value), default_value = _c[0], set_default_value = _c[1];
    var _d = (0, react_1.useState)(true), disable = _d[0], set_disable = _d[1];
    var _e = (0, react_1.useState)(0), selected_index = _e[0], set_selected_index = _e[1];
    (0, react_1.useEffect)(function () {
        var _a;
        console.log(id, preset_list);
        var idx = preset_list.findIndex(function (v) { return v === get_default_value; });
        if (idx !== -1)
            set_selected_index(idx);
        var sel_preset = preset_list[idx];
        var _b = [0, 0], w = _b[0], h = _b[1];
        try {
            _a = sel_preset.split("x").map(function (v) { return Number(v); }), w = _a[0], h = _a[1];
            set_args([w, h]);
        }
        catch (_c) {
        }
        finally {
            set_default_value(preset_list[idx]);
        }
    }, [get_default_value]);
    var handleChange = function (e, setup_f) {
        var regex = /^[0-9\b]*$/;
        if (e.target.value === "" || regex.test(e.target.value)) {
            var fx = Math.abs(Number(e.target.value));
            setup_f(fx);
        }
    };
    var builder = function () {
        var custom_btn;
        if (customizable)
            custom_btn = <MenuItem_1.default id={id + "custom"} value={"custom"}>{"Custom"}</MenuItem_1.default>;
        return (<Grid_1.default container direction="column">
                <Grid_1.default item>
                    <FormControl_1.default>
                        <Select_1.default labelId="sels" id={id} value={default_value} style={{ minWidth: "200px" }} onChange={function (e) {
                if (e.target.value === "custom") {
                    set_disable(false);
                    set_default_value("custom");
                }
                else {
                    // let [width, height] = e.target.value.split("x").map((v)=>Number(v))
                    set_disable(true);
                    onSelect_f(e.target.value);
                }
            }}>
                        {preset_list.map(function (v, i, a) { return (<MenuItem_1.default id={String(i)} value={v}>{v}</MenuItem_1.default>); })}
                            {custom_btn}
                        </Select_1.default>
                    </FormControl_1.default>
                    </Grid_1.default>
                    {flag &&
                <Grid_1.default item>
                        <TextField_1.default disabled={disable} label="width" defaultValue="0" variant="filled" value={args[0]} onBlur={function (e) {
                        var width = Number(e.target.value);
                        set_args([width, args[1]]);
                        onselected_customize_f(0, width);
                    }} onChange={function (e) {
                        handleChange(e, function (w) {
                            var _a = preset_list[preset_list.length - 1].split("x").map(function (v) { return Number(v); }), mw = _a[0], mh = _a[1];
                            if (w > mw) {
                                w = mw;
                            }
                            set_args([w, args[1]]);
                        });
                    }} InputProps={{
                        style: { margin: 1, maxWidth: "100px" }
                    }}/>
                        <TextField_1.default disabled={disable} 
                // id="filled-disabled"
                label="height" defaultValue="1080" variant="filled" onBlur={function (e) {
                        var height = Number(e.target.value);
                        onselected_customize_f(1, height);
                    }} onChange={function (e) {
                        handleChange(e, function (h) {
                            var _a = preset_list[preset_list.length - 1].split("x").map(function (v) { return Number(v); }), mw = _a[0], mh = _a[1];
                            if (h > mw) {
                                h = mh;
                            }
                            set_args([args[0], h]);
                        });
                    }} value={args[1]} InputProps={{
                        style: { margin: 1, maxWidth: "100px" }
                    }}/>
                    </Grid_1.default>}
                </Grid_1.default>);
    };
    return (<Box_1.default display="flex" justifyContent="center">
        {builder()}
    </Box_1.default>);
}
exports.default = WindowSizeComponent;
//# sourceMappingURL=WindowSizeComponent.js.map