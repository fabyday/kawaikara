import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { createTheme, CssBaseline, Fade, Typography } from '@mui/material';
import Favorites from './favorites';
import { KawaiMenuComponent, menu_state } from './states';
import { ThemeProvider } from '@emotion/react';
import { KawaiConfig } from '../../typescript_src/definitions/setting_types';

const App: React.FC = () => {
    const [fetch, favorites_list] = menu_state((state) => [
        state.fetch,
        state.favorites,
    ]);

    const [darkmode, setDarkMode] = useState(false);
    const [version, setVersion] = useState('');
    const theme = createTheme({
        palette: {
            mode: darkmode ? 'dark' : 'light',
        },
    });

    useEffect(() => {
        fetch();
        window.KAWAI_API.etc.version().then((version: string) => {
            setVersion(version);
        });
        window.KAWAI_API.preference
            .load_config()
            .then((config: KawaiConfig) => {
                setDarkMode(config?.general?.dark_mode?.value ?? false);
            });

        window.KAWAI_API.preference.notify_config_update(async () => {
            const config = await window.KAWAI_API.preference.load_config();
            setDarkMode(config?.general?.dark_mode?.value ?? false);
        });
        window.KAWAI_API.menu.notify_menu_update(fetch);
    }, []);

    let reval = (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    // backgroundColor: 'transparent',
                    height: '100vh',
                    width: '100vw',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                <Box>
                    <Typography
                        typography={'Test'}
                        fontSize={'3em'}
                        fontWeight={700}>
                        KAWAIKARA {version}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        // backgroundColor: 'transparent',
                        alignItems: 'center',
                        margin: 3,
                        justifyContent: 'center',
                    }}>
                    <img
                        width={'80%'}
                        src="kawai://resources/icons/kawaikara_banner.png"></img>
                </Box>

                <Box
                    sx={{
                        width: '80%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                    <Favorites
                        favorites_list={favorites_list!}
                        onClicked={async (id: string) => {
                            await window.KAWAI_API.menu.select_menu_item(id);
                        }}
                    />
                </Box>
            </Box>
        </ThemeProvider>
    );

    return reval;
};

export default App;
