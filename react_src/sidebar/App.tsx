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
import MenuItemBar2 from './menubar';
const App: React.FC = () => {
    const [
        fetch,
        category_map,
        favorites_list,
        menu_map,
        current_category,
        set_current_category,
    ] = menu_state((state) => [
        state.fetch,
        state.category_map,
        state.favorites,
        state.menu_map,
        state.current_category,
        state.set_current_category,
    ]);
    const [fade, setFade] = useState(false);
    const fade_time = 266;
    useEffect(() => {
        fetch();
        setFade(true);
        window.KAWAI_API.menu.on_notify_menu_status((state: string) => {
            if (state === 'open') setFade(true);
            else {
                setFade(false);
                setTimeout(() => {
                    window.KAWAI_API.menu.close();
                }, fade_time);
            }
        });
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
            const val = category_map.get(v);
            reval.push(val!);
        });
        return reval;
    };

    let reval = (
        <Fade in={fade} timeout={fade_time}>
            <Box
                onClick={async () => {
                    setFade(false);
                    setTimeout(() => {
                        window.KAWAI_API.menu.close();
                    }, fade_time);
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
                        // backgroundColor: 'transparent',
                        height: '80%',
                        width: '40%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '10px',
                    }}>
                    <Favorites
                        favorites_list={favorites_list!}
                        onClicked={async (id: string) => {
                            await window.KAWAI_API.menu.select_menu_item(id);
                            setFade(false);
                            setTimeout(() => {
                                window.KAWAI_API.menu.close();
                            }, fade_time);
                        }}
                    />
                    <Box
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        display="flex"
                        flexDirection="row"
                        alignItems="flex-start"
                        sx={{
                            background: 'rgba(200, 200, 200, 1.0)',
                            height: '50%',
                            margin: '2px',
                            width: '99%',
                            justifyContent: 'center',
                            borderRadius: '20px',
                        }}>
                        <MenuItemBar2
                            selected_category_id={current_category}
                            category_list={get_category_deserialize()}
                            
                            onCategoryClick={(id: string) => {
                                set_current_category(id);
                            }}
                            menu_item={get_menu_deserialize(current_category)}
                            onMenuClick={async (id: string) => {
                                await window.KAWAI_API.menu.select_menu_item(
                                    id,
                                );
                                setFade(false);
                                setTimeout(() => {
                                    window.KAWAI_API.menu.close();
                                }, fade_time);
                            }}
                            onFavoritesClick={(
                                id: string,
                                cur_fav_state: boolean,
                            ) => {
                                if (cur_fav_state) {
                                    window.KAWAI_API.menu.delete_favorites(id);
                                } else {
                                    window.KAWAI_API.menu.add_favorites(id);
                                }
                            }}></MenuItemBar2>
                        {/* <Box
                            sx={{
                                flex: 1,
                                justifyContent: 'center',
                            }}>
                            <MenuItemBar
                                selected_category_id={current_category}
                                category_list={get_category_deserialize()}
                                onclicked={(id: string) => {
                                    set_current_category(id);
                                }}
                            />
                        </Box>
                        {current_category != null ? (
                            <Box
                                sx={{
                                    flex: 1,
                                    justifyContent: 'center',
                                }}>
                                <SubmenuBar
                                    menu_item={get_menu_deserialize(
                                        current_category,
                                    )}
                                    onClicked={async (id: string) => {
                                        await window.KAWAI_API.menu.select_menu_item(
                                            id,
                                        );
                                        setFade(false);
                                        setTimeout(() => {
                                            window.KAWAI_API.menu.close();
                                        }, fade_time);
                                    }}
                                    onFavoritesClick={(
                                        id: string,
                                        cur_fav_state: boolean,
                                    ) => {
                                        if (cur_fav_state) {
                                            window.KAWAI_API.menu.delete_favorites(
                                                id,
                                            );
                                        } else {
                                            window.KAWAI_API.menu.add_favorites(
                                                id,
                                            );
                                        }
                                    }}
                                    // menu_item={get_menu_deserialize("ott")}
                                />
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    flex: 1,
                                }}></Box>
                        )} */}
                    </Box>
                </Box>
            </Box>
        </Fade>
    );

    return reval;
};

export default App;
