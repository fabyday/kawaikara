"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var client_1 = __importDefault(require("react-dom/client"));
var App_1 = __importDefault(require("./App"));
// import App from "./App";
var root = client_1.default.createRoot(document.getElementById('root'));
// const theme = createTheme({
//     components: {
//       MuiCssBaseline: {
//         styleOverrides: {
//           body: {
//             '::-webkit-scrollbar': {
//               display: 'none', // Chrome, Safari, Edge
//             },
//             '-ms-overflow-style': 'none', // IE, Edge
//             'scrollbar-width': 'none', // Firefox
//             overflow: 'hidden', // 스크롤 비활성화
//           },
//         },
//       },
//     },
//   });
root.render(<react_1.default.StrictMode>
    {/* <ThemeProvider theme={ theme}> */}

<App_1.default></App_1.default>
    {/* </ThemeProvider> */}
</react_1.default.StrictMode>);
//# sourceMappingURL=sidebar.js.map