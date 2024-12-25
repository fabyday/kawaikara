import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createTheme, ThemeProvider } from '@mui/material';
// import App from "./App";

const root = ReactDOM.createRoot(document.getElementById('root')!);
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
  
root.render(
<React.StrictMode>
    {/* <ThemeProvider theme={ theme}> */}

<App></App>
    {/* </ThemeProvider> */}
</React.StrictMode>
);