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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importStar(require("react"));
var GeneralPreferences_1 = __importDefault(require("./GeneralPreferences"));
var ShortcutPreferences_1 = __importDefault(require("./ShortcutPreferences"));
var Footer_1 = __importDefault(require("./Footer"));
var Header_1 = __importDefault(require("./Header"));
var styled_1 = __importDefault(require("@emotion/styled"));
var react_router_dom_1 = require("react-router-dom");
var definition_1 = require("./definition");
var ContentComponent = (0, styled_1.default)('div')({
    //    paddingTop : "7%",
    margin: "7%"
});
var RootComponent = (0, styled_1.default)('div')({
    alignItems: "center",
});
function App() {
    var _this = this;
    var _a = (0, definition_1.usePrevConfigureStore)(function (state) { return [state.fetch, state.copy_from, state.is_changed]; }), new_fetch = _a[0], copy_from_p = _a[1], compare_with = _a[2];
    var _b = (0, definition_1.useCurConfigureStore)(function (state) { return [state, state.copy_from]; }), cur_state = _b[0], copy_from = _b[1];
    var reset_from_conf = (0, definition_1.save_flag)(function (state) { return state.reset_from_conf; });
    (0, react_1.useEffect)(function () {
        new_fetch(function () { return __awaiter(_this, void 0, void 0, function () {
            var prev;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, window.preference_api.get_data()];
                    case 1:
                        prev = _a.sent();
                        copy_from_p(prev);
                        copy_from(prev);
                        reset_from_conf(prev);
                        console.log("prev", prev);
                        return [2 /*return*/, prev];
                }
            });
        }); });
    }, []);
    return (<RootComponent>
         <react_router_dom_1.MemoryRouter initialEntries={["/general"]}>
         <Header_1.default />
         <ContentComponent>
         <react_router_dom_1.Routes>
             <react_router_dom_1.Route path="/general" element={<GeneralPreferences_1.default />}></react_router_dom_1.Route>
             <react_router_dom_1.Route path="/shortcut" element={<ShortcutPreferences_1.default></ShortcutPreferences_1.default>}></react_router_dom_1.Route>
            </react_router_dom_1.Routes>
         </ContentComponent>
          </react_router_dom_1.MemoryRouter>
         <Footer_1.default /> 
         </RootComponent>);
}
exports.default = App;
//# sourceMappingURL=App.js.map