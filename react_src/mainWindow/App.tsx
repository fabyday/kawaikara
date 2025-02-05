import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { Fade, Typography } from '@mui/material';
import Favorites from './favorites';
import { KawaiMenuComponent, menu_state } from './states';

const App: React.FC = () => {
    const [fetch, favorites_list] = menu_state((state) => [
        state.fetch,
        state.favorites,
    ]);
    useEffect(() => {
        fetch();
        window.KAWAI_API.menu.notify_menu_update(fetch);
    }, []);

    let reval = (
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
                <Typography typography={'Test'} fontSize={"3em"} fontWeight={700}>
                    KAWAIKARA 2.0.0
                </Typography>
                <img></img>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    // backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                <img
                    width={'60%'}
                    src="kawai://imgs/kawaikara_banner.png"></img>
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
    );

    return reval;
};

export default App;
