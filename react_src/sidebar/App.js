"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var PrimaryMenuBar_1 = __importDefault(require("./PrimaryMenuBar"));
var Favorites_1 = __importDefault(require("./Favorites"));
var ChildMenuItemBar_1 = __importDefault(require("./ChildMenuItemBar"));
var App = function () {
    // useEffect( ()=>{
    //           let prev =  window.menu_api.initialize_data().then((e)=>{console.log(e)})
    //           console.log(prev)
    // }, [])
    var reval = <Box_1.default display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ height: '100vh', gap: 2 }}>
  <Favorites_1.default />
  <Box_1.default display="flex" flexDirection="row" alignItems="flex-start">
    <PrimaryMenuBar_1.default />
    <ChildMenuItemBar_1.default />
  </Box_1.default>
  </Box_1.default>;
    return (reval);
};
exports.default = App;
//# sourceMappingURL=App.js.map