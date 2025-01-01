"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var ShortcutTextfield_1 = __importDefault(require("./ShortcutTextfield"));
var material_1 = require("@mui/material");
var Typography_1 = __importDefault(require("@mui/material/Typography"));
var definition_1 = require("./definition");
var types_1 = require("../../typescript_src/definitions/types");
var rawstack_style = {
    textAlign: "center",
};
function ShortcutPreference() {
    var save_checker = (0, definition_1.save_flag)(function (state) { return state.check_duplication_shortcut; });
    var _a = (0, definition_1.useCurConfigureStore)(function (state) { return [state.get_property, state.set_property]; }), get_property = _a[0], set_property = _a[1];
    var root_id = "configure.shortcut";
    var shortcut_list = get_property(root_id);
    var render_list = [];
    if ((0, types_1.isCItemArray)(shortcut_list === null || shortcut_list === void 0 ? void 0 : shortcut_list.item)) {
        render_list = shortcut_list.item.map(function (v) { return (<material_1.Grid container sx={rawstack_style} rowGap={1} spacing={1}>
                <material_1.Grid container sx={rawstack_style} spacing={12}> </material_1.Grid>
                <material_1.Grid item xs={6}> <Typography_1.default>{v.name}</Typography_1.default> </material_1.Grid>
                <material_1.Grid item xs={6}>
                    <ShortcutTextfield_1.default id={v.id} set_shortcut_f={function (e) { console.log(get_property("configure.shortcut")); set_property(root_id + "." + v.id, e); }} get_shortcut_f={function () { return v.item; }} duplication_check_f={function (text) {
                return !save_checker(v.id, text);
            }}/>
                    </material_1.Grid>
            </material_1.Grid>); });
    }
    return (<material_1.Box>
        <Typography_1.default fontWeight={"medium"} fontSize={32}>{shortcut_list === null || shortcut_list === void 0 ? void 0 : shortcut_list.name}</Typography_1.default>
        {render_list}
        </material_1.Box>);
}
exports.default = ShortcutPreference;
//# sourceMappingURL=ShortcutPreferences.js.map