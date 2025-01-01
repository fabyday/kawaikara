"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var Button_1 = __importDefault(require("@mui/material/Button"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var Grid_1 = __importDefault(require("@mui/material/Grid"));
var styled_1 = __importDefault(require("@emotion/styled"));
var react_router_dom_1 = require("react-router-dom");
var definition_1 = require("./definition");
var HeaderComponent = (0, styled_1.default)(Box_1.default)({
    color: 'darkslategray',
    backgroundColor: 'blue',
    width: "100%",
    top: 0,
    left: 0,
    position: "fixed",
    margin: 0,
    zIndex: 100,
    display: "flex"
});
function Header() {
    // let button_names = ["General", "Shortcut"];
    // let button_ids = ["gen", "short"]
    // let link_paths = ["general", "shortcut"]
    var var_type = ["contained", "outlined"];
    var _a = react_1.default.useState(0), selected_btn = _a[0], set_sel_btn = _a[1];
    var get_property = (0, definition_1.useCurConfigureStore)(function (state) { return state.get_property; });
    var general = get_property("configure.general");
    var shortcut = get_property("configure.shortcut");
    var button_names = [];
    var link_paths = [];
    if (typeof general !== "undefined" && typeof shortcut !== "undefined") {
        button_names = [general.name, shortcut.name];
        link_paths = [general.id, shortcut.id];
    }
    var button_clicked = function (id) {
        set_sel_btn(id);
    };
    var button_generater = function () {
        var buttons = [];
        var _loop_1 = function (i) {
            var button = void 0;
            var style = { background: "white" };
            var new_variant = "outlined";
            if (selected_btn === i) {
                style = { background: "blue" };
                new_variant = "contained";
            }
            button = (<react_router_dom_1.Link to={link_paths[i]}>
           <Button_1.default key={"button" + String(i)} style={style} id={"button" + String(i)} onClick={function () { return button_clicked(i); }} color='primary' variant={new_variant}>
                                                    {button_names[i]}
                      </Button_1.default>
                    </react_router_dom_1.Link>);
            buttons.push(button);
        };
        for (var i = 0; i < button_names.length; i++) {
            _loop_1(i);
        }
        return buttons;
    };
    return (<HeaderComponent id="header">        
        <Grid_1.default container columnGap={1} columns={12}>

          <Grid_1.default xs={6} item>
            <Box_1.default columnGap={1} display="flex" justifyContent="flex-start">
              {button_generater()}
            </Box_1.default>
          </Grid_1.default>
        </Grid_1.default>
        </HeaderComponent>);
}
exports.default = Header;
//# sourceMappingURL=Header.js.map