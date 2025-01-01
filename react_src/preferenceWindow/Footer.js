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
var Button_1 = __importDefault(require("@mui/material/Button"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var Grid_1 = __importDefault(require("@mui/material/Grid"));
var styled_1 = __importDefault(require("@emotion/styled"));
var definition_1 = require("./definition");
var FooterComponent = (0, styled_1.default)('div')({
    color: 'darkslategray',
    backgroundColor: 'aliceblue',
    width: "100%",
    position: "fixed",
    bottom: 0,
    left: 0,
    zIndex: 100,
});
function Footer() {
    var reset_from_conf = (0, definition_1.save_flag)(function (state) { return state.reset_from_conf; });
    var copyfrom = (0, definition_1.usePrevConfigureStore)(function (state) { return state.copy_from; });
    var _a = (0, definition_1.useCurConfigureStore)(function (state) { return [state, state.configure]; }), cur_state = _a[0], cur_config = _a[1];
    var o = (0, definition_1.useCurConfigureStore)(function (state) { return state; });
    var _b = react_1.default.useState(false), is_changed = _b[0], conf_change_set_f = _b[1];
    var _c = react_1.default.useState(true), is_validate_shortcut = _c[0], valid_shortcut_f = _c[1];
    var _d = react_1.default.useState(true), disable_apply = _d[0], disable_apply_f = _d[1];
    var _e = (0, definition_1.usePrevConfigureStore)(function (state) { return [state.configure, state.is_changed]; }), prev_state = _e[0], prev_is_changed_state = _e[1];
    var unsub = definition_1.useCurConfigureStore.subscribe(function (cur_state) {
        console.log("======sent!");
        console.log(cur_state.configure);
        console.log(prev_state);
        if (typeof cur_state.configure !== "undefined") {
            if (prev_is_changed_state(cur_state.configure)) {
                console.log("true");
                conf_change_set_f(false);
            }
            else {
                console.log("false");
                conf_change_set_f(true);
            }
        }
    });
    var save_flag_unsub = definition_1.save_flag.subscribe(function (state) {
        if (state.check_whole_shortcut()) {
            console.log("is valid");
            valid_shortcut_f(true);
        }
        else {
            valid_shortcut_f(false);
        }
    });
    (0, react_1.useEffect)(function () {
        return unsub;
    }, []);
    (0, react_1.useEffect)(function () {
        return save_flag_unsub;
    }, []);
    (0, react_1.useEffect)(function () {
        console.log("is changed?", is_changed);
        if (is_changed) {
            console.log("wwww", is_changed);
            console.log("test1", is_changed);
            disable_apply_f(false);
            console.log("tewwwst", is_changed);
        }
        else {
            disable_apply_f(true);
        }
        // console.log("validate key", is_validate_shortcut)
        // if(!is_validate_shortcut){
        //     disable_apply_f(true)
        // }else{
        //     disable_apply_f(false)
        // }
        console.log(disable_apply);
    }, [is_validate_shortcut, is_changed]);
    return (<FooterComponent>
        <Grid_1.default container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid_1.default xs={6} item>
        <Box_1.default columnGap={1} display="flex" justifyContent="center">
        <Button_1.default variant="contained" onClick={function () {
            if (disable_apply) {
                window.preference_api.just_close_preference_window();
            }
            else {
                window.preference_api.apply_changed_preference(o.configure);
                window.preference_api.just_close_preference_window();
            }
        }}>OK</Button_1.default>
        <Button_1.default variant="contained" onClick={function () {
            window.preference_api.just_close_preference_window();
        }}>Cancel</Button_1.default>
        <Button_1.default variant="contained" onClick={function () {
            window.preference_api.apply_changed_preference(o.configure);
            copyfrom(cur_config);
            reset_from_conf(cur_config);
            conf_change_set_f(false);
            disable_apply_f(true);
            valid_shortcut_f(true);
        }} disabled={disable_apply}>apply</Button_1.default>
        </Box_1.default>
        </Grid_1.default>
        </Grid_1.default>
        </FooterComponent>);
}
exports.default = Footer;
//# sourceMappingURL=Footer.js.map