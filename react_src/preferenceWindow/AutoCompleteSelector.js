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
var Grid_1 = __importDefault(require("@mui/material/Grid"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var Typography_1 = __importDefault(require("@mui/material/Typography"));
var react_1 = __importStar(require("react"));
var WindowSizeComponent_1 = __importDefault(require("./WindowSizeComponent"));
function KawaiAutoCompleteSelector(_a) {
    var id = _a.id, title = _a.title, preset_list = _a.preset_list, get_default_value = _a.get_default_value, select_f = _a.select_f, onselected_customize_f = _a.onselected_customize_f, additional_textedit = _a.additional_textedit;
    var _b = react_1.default.useState(get_default_value), default_val = _b[0], set_checked = _b[1];
    (0, react_1.useEffect)(function () {
        set_checked(get_default_value);
    }, [get_default_value]);
    return (<Grid_1.default container spacing={12}>
            <Grid_1.default item xs={6}> <Typography_1.default>{title}</Typography_1.default> </Grid_1.default>
            <Grid_1.default item xs={6}>
                    <Box_1.default display="flex" justifyContent="center">
                    <WindowSizeComponent_1.default id={id} preset_list={preset_list} get_default_value={default_val} onSelect_f={select_f} onselected_customize_f={onselected_customize_f} customizable={additional_textedit}/>
                    </Box_1.default>
                </Grid_1.default>
            </Grid_1.default>);
}
exports.default = KawaiAutoCompleteSelector;
//# sourceMappingURL=AutoCompleteSelector.js.map