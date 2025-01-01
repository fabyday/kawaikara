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
var Switch_1 = __importDefault(require("@mui/material/Switch"));
var react_1 = __importStar(require("react"));
function KawaiSwitch(_a) {
    var id = _a.id, title = _a.title, defaultchecked = _a.defaultchecked, onclick = _a.onclick;
    var _b = react_1.default.useState(defaultchecked), checked = _b[0], set_checked = _b[1];
    (0, react_1.useEffect)(function () {
        set_checked(defaultchecked);
    }, [defaultchecked]);
    return (<Grid_1.default container spacing={12}>
            <Grid_1.default item xs={6}> <Typography_1.default>{title}</Typography_1.default> </Grid_1.default>
            <Grid_1.default item xs={6}>
                    <Box_1.default display="flex" justifyContent="center">
                        <Switch_1.default checked={defaultchecked} onClick={function () {
            var new_checked = !checked;
            set_checked(new_checked);
            onclick(new_checked);
        }}/>
                    </Box_1.default>
                </Grid_1.default>
            </Grid_1.default>);
}
exports.default = KawaiSwitch;
//# sourceMappingURL=Switch.js.map