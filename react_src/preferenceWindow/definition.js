"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
exports.usePrevConfigureStore = exports.useCurConfigureStore = exports.save_flag = void 0;
var zustand_1 = require("zustand");
var types_1 = require("../../typescript_src/definitions/types");
var lodash_1 = __importDefault(require("lodash"));
exports.save_flag = (0, zustand_1.create)(function (set, get) { return ({
    shortcut_validation: true,
    shortcut_to_id_map: new Map(),
    shortcut_id_to_shortcut_map: new Map(),
    check_duplication_shortcut: function (id, shortcut_text) {
        // if duplication problem exsits, then return true
        // else return false
        var shortcut_id_to_key = lodash_1.default.cloneDeep(get().shortcut_id_to_shortcut_map);
        var shortcut_key_to_id = lodash_1.default.cloneDeep(get().shortcut_to_id_map);
        var prev_shortcut_key = shortcut_id_to_key.get(id);
        shortcut_id_to_key.set(id, shortcut_text);
        var ids_duplicate_shortcut_key = shortcut_key_to_id.get(shortcut_text);
        var re_flag = false;
        // if prev shortcut key exists, then delete this infos.
        // and I don't track "" and undefined.
        if (prev_shortcut_key !== "" && prev_shortcut_key !== undefined) {
            var prev_ids_duplicate_shortcut_key = shortcut_key_to_id.get(prev_shortcut_key);
            if (prev_ids_duplicate_shortcut_key !== undefined) {
                prev_ids_duplicate_shortcut_key.delete(id);
                if (prev_ids_duplicate_shortcut_key.size === 0)
                    shortcut_key_to_id.delete(prev_shortcut_key);
            }
        }
        if (ids_duplicate_shortcut_key === undefined || ids_duplicate_shortcut_key.size == 0) {
            shortcut_key_to_id.set(shortcut_text, new Set());
            // re flag is false
            re_flag = false;
        }
        if (shortcut_text !== "" && shortcut_text !== undefined) {
            ids_duplicate_shortcut_key = shortcut_key_to_id.get(shortcut_text);
            ids_duplicate_shortcut_key.add(id);
            var size = ids_duplicate_shortcut_key.size;
            if (size > 1) {
                re_flag = true;
            }
        }
        set(function (state) { return (__assign(__assign({}, state), { shortcut_id_to_shortcut_map: shortcut_id_to_key, shortcut_to_id_map: shortcut_key_to_id })); });
        return re_flag;
    },
    check_whole_shortcut: function () {
        var flag = true;
        var shortcut_to_id = get().shortcut_to_id_map;
        for (var _i = 0, shortcut_to_id_1 = shortcut_to_id; _i < shortcut_to_id_1.length; _i++) {
            var s = shortcut_to_id_1[_i];
            if (s[1].size > 1) {
                flag && (flag = false);
            }
        }
        return flag;
    },
    reset_from_conf: function (conf) {
        var _a;
        var shortcut_list = (_a = (0, types_1.getProperty)(conf, "configure.shortcut")) === null || _a === void 0 ? void 0 : _a.item;
        var tmp_id_2_sc = get().shortcut_id_to_shortcut_map;
        var tmp_sc_2_id = get().shortcut_to_id_map;
        tmp_id_2_sc.clear();
        tmp_sc_2_id.clear();
        if (typeof shortcut_list !== "undefined") {
            if ((0, types_1.isCItemArray)(shortcut_list)) {
                shortcut_list.map(function (vv) {
                    var _a, _b;
                    if (vv.item !== "") {
                        if (((_a = tmp_sc_2_id.get(vv.item)) === null || _a === void 0 ? void 0 : _a.size) === undefined) {
                            tmp_sc_2_id.set(vv.item, new Set());
                            (_b = tmp_sc_2_id.get(vv.item)) === null || _b === void 0 ? void 0 : _b.add(vv.id);
                            tmp_id_2_sc.set(vv.id, vv.item);
                        }
                        else {
                            tmp_sc_2_id.get(vv.item).add(vv.id);
                            tmp_id_2_sc.set(vv.id, vv.item);
                        }
                    }
                });
            }
        }
        set(function (state) { return (__assign(__assign({}, state), { shortcut_id_to_shortcut_map: tmp_id_2_sc, shortcut_to_id_map: tmp_sc_2_id })); });
        set(function (state) { return (__assign(__assign({}, state), { shortcut_validation: get().check_whole_shortcut() })); });
    }
}); });
var context = function (set, get) { return ({
    configure: undefined,
    is_changed: function (new_) {
        var c = get();
        if (typeof c.configure === "undefined")
            // return typeof new_ === "undefined"
            return false;
        return (0, types_1.isEqualConfigure)(c.configure, new_);
    },
    fetch: function (f) { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, f()];
                case 1:
                    response = (_a.sent());
                    set(function (state) { return (__assign(__assign({}, state), { configure: response })); });
                    return [2 /*return*/];
            }
        });
    }); },
    copy_from: function (conf) {
        set(function (state) { return (__assign(__assign({}, state), { configure: lodash_1.default.cloneDeep(conf) })); });
        var t = get().configure;
        if (typeof t !== 'undefined') {
            console.log("console.log : copy from is called");
        }
    },
    get_property: function (id) {
        var conf = get().configure;
        if (typeof conf !== "undefined") {
            var item = (0, types_1.getProperty)(conf, id);
            return item;
        }
        return undefined;
    },
    set_property: function (id, item_value) {
        set(function (state) {
            if (typeof state.configure !== "undefined") {
                var porperty = (0, types_1.getProperty)(state.configure, id);
                if (typeof porperty !== "undefined") {
                    porperty.item = item_value;
                    return lodash_1.default.cloneDeep(state);
                }
            }
            return state;
        });
    },
}); };
exports.useCurConfigureStore = (0, zustand_1.create)(context);
exports.usePrevConfigureStore = (0, zustand_1.create)(context);
//# sourceMappingURL=definition.js.map