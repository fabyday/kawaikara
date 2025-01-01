"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_markdown_1 = __importDefault(require("react-markdown"));
var rehype_raw_1 = __importDefault(require("rehype-raw"));
var remark_gfm_1 = __importDefault(require("remark-gfm"));
var App = function () {
    var _a = (0, react_1.useState)(""), post = _a[0], setup = _a[1];
    (0, react_1.useEffect)(function () {
        window.main_api.get_version().then(function (version_string) {
            var version = "v" + version_string;
            var readme_url = "https://raw.githubusercontent.com/fabyday/kawaikara/".concat(version, "/README.MD");
            var raws_root = "https://github.com/fabyday/kawaikara/raw/".concat(version);
            fetch(readme_url).then(function (e) { return e.blob(); }).then(function (v) { return v.text(); }).then(function (v) {
                var re = /(\<img[^\/][\s]*[\w]*src=)["'](\.)(.*)["']/g;
                v = v.replaceAll(re, "$1\"".concat(raws_root, "/$3\""));
                setup(v);
            });
        });
    }, []);
    return (<react_markdown_1.default remarkPlugins={[remark_gfm_1.default]} rehypePlugins={[rehype_raw_1.default]} components={{ img: function (_a) {
            var node = _a.node, props = __rest(_a, ["node"]);
            return <img style={{ maxWidth: '100%' }} {...props}/>;
        } }}>
                {post}
            </react_markdown_1.default>);
};
exports.default = App;
//# sourceMappingURL=App.js.map