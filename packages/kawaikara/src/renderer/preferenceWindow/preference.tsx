import React from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const theme = createTheme({
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

root.render(


  <React.StrictMode>
    <ThemeProvider theme={theme}>
    <CssBaseline /> {/* MUI 기본 스타일 리셋 */}

    <App ></App>
    </ThemeProvider>
  </React.StrictMode>
);