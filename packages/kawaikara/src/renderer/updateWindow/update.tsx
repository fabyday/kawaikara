import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, GlobalStyles } from '@mui/material';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
    <React.StrictMode>
        <CssBaseline />
        <GlobalStyles
            styles={{
                html: {
                    height: '100%',
                },
                body: {
                    height: '100%',
                    margin: 0,
                    overflow: 'hidden',
                },
                '#root': {
                    height: '100%',
                },
            }}
        />
        <App />
    </React.StrictMode>,
);
