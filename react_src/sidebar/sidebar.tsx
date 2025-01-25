import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
// import App from "./App";
const theme = createTheme({
    palette : {
        background :{
            default : 'rgba(255, 255, 255, 0)'
        }
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    userSelect: 'none', // 텍스트 선택 방지
                    '-webkit-user-select': 'none', // Safari 지원
                    '-moz-user-select': 'none', // Firefox 지원
                    '-ms-user-select': 'none', // IE10+ 지원
                    '-webkit-user-drag': 'none', // 드래그 방지
                    '-moz-user-drag': 'none', // Firefox에서 드래그 방지
                },
            },
        },
    },
});
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline /> {/* MUI 기본 스타일 리셋 */}
        </ThemeProvider>
        <App />
    </React.StrictMode>,
);
