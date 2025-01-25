import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import {
    Collapse,
    Fade,
    Grid,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
} from '@mui/material';
import SubmenuBar from './SubmenuBar';
import Favorites from './Favorites';
import MenuItemBar from './MenuItemBar';
import { KawaiMenuComponent, menu_state } from './states';
const App: React.FC = () => {
    const [
        fetch,
        category_map,
        menu_map,
        current_category,
        set_current_category,
    ] = menu_state((state) => [
        state.fetch,
        state.category_map,
        state.menu_map,
        state.current_category,
        state.set_current_category,
    ]);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        fetch();
        console.log("test")
        setFade(true)
        window.KAWAI_API.menu.notify_menu_update(fetch);
    }, []);
    const get_menu_deserialize = (category_id: string | null) => {
        if (category_id == null) {
            return new Array<KawaiMenuComponent>();
        }
        const submenu_map = menu_map.get(category_id);
        if (typeof submenu_map === 'undefined') {
            return new Array<KawaiMenuComponent>();
        }
        return Array.from(submenu_map.values());
    };
    const get_category_deserialize = () => {
        const reval = new Array<KawaiMenuComponent>();
        [...category_map.keys()].forEach((v) => {
            console.log('fro');
            const val = category_map.get(v);
            reval.push(val!);
        });
        return reval;
    };

    let reval = (
        <Fade in = {fade} timeout={266}>
        <Box

        onClick={async ()=>{
            setFade(false);
            setTimeout(window.KAWAI_API.menu.close, 1000)
        }}
            sx={{
                margin: 0,
                padding: 0,
                top: 0,
                left: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                height: '100%',
                width: '100%',
                alignItems: 'center',
                position: 'absolute',
                justifyContent: 'center',
            }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgb(149, 47, 197)',
                    height: '80%',
                    width: '70%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                }}>
                {/* <Favorites /> */}

                <Box
                    display="flex"
                    flexDirection="row"
                    alignItems="flex-start"
                    sx={{
                        background: 'rgb(29, 211, 165)',
                        height: '50%',
                        margin: '2px',
                        width: '99%',
                        borderRadius: '10px',
                    }}>
                    <MenuItemBar
                        selected_category_id={current_category}
                        category_list={get_category_deserialize()}
                        onclicked={(id: string) => {
                            set_current_category(id);
                        }}
                    />
                    <SubmenuBar
                        menu_item={get_menu_deserialize(current_category)}
                        // menu_item={get_menu_deserialize("ott")}
                    />
                </Box>
            </Box>
        </Box>
        </Fade>
    );

    return reval;
};

export default App;
