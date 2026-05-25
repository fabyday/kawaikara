import ReactDOM from 'react-dom';
import App from './App';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Global } from '@emotion/react';

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

ReactDOM.render(
    <ThemeProvider theme={theme}>
        <CssBaseline>
            <App />
        </CssBaseline>
    </ThemeProvider>,
    document.getElementById('root'),
);
