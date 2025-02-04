import React, { ReactEventHandler, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import {
    List,
    ListSubheader,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
} from '@mui/material';
import KListItemButton from './KListItemButton';
import { KawaiMenuComponent } from './states';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
type prop = {
    selected_category_id: string | null;
    category_list: KawaiMenuComponent[];
    menu_item: KawaiMenuComponent[];
    onCategoryClick: (id: string) => void;
    onMenuClick: (id: string) => void;
    onFavoritesClick: (id: string, current_fav_state: boolean) => void;
};

const MenuItemBar2 = ({
    selected_category_id,
    category_list,
    menu_item,
    onCategoryClick,
    onMenuClick,
    onFavoritesClick,
}: prop) => {
    // return reval;

    const create_menu = () => {
        const flat_cat = category_list.map((categoryComponent) => {
            if (categoryComponent.id) {
                return create_submenu(categoryComponent.id);
            }
        });

        return (
            <List
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    // border: '1px solid red',
                    justifyContent: 'center',

                    flexDirection: 'row',
                    padding: 0,
                }}>
                {flat_cat}
            </List>
        );
    };

    const create_submenu = (category_id: string) => {
        const submenu_bar = menu_item.map((item) => {
            return (
                <ListItemButton
                    sx={{}}
                    onClick={() => {
                        onMenuClick(item.id);
                    }}>
                    <ListItemText
                        sx={{
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                        }}
                        primary={item.name}
                    />
                </ListItemButton>
            );
        });

        return (
            <Box
                sx={{
                    border: '1px solid blue',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                <Box sx={{ bgcolor: 'blue', flexShrink: 0 }}>
                    <ListSubheader
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1000,
                            textOverflow: 'ellipsis',
                        }}>
                        <ListItemButton
                         sx={{
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                        }}
                            onClick={() => {
                                onCategoryClick(category_id);
                            }}>
                            <ListItemText
                                sx={{
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                }}
                                primary={category_id}
                            />
                            {selected_category_id === category_id ? (
                                <ExpandLess />
                            ) : (
                                <ExpandMore />
                            )}
                        </ListItemButton>
                    </ListSubheader>
                </Box>
                <Box
                    sx={{
                        overflow: 'auto',
                        border: '1px solid red',

                        '&::-webkit-scrollbar': {
                            width: '8px', // 스크롤바의 너비
                            backgroundColor: 'rgba(255, 255, 255, 0)',
                            transition: 'backgroundColor 10.0s ease', // 부드럽게 나타나도록
                            visibility: 'hidden', // 기본 상태에서 스크롤바 숨기기
                        },
                        '&:hover::-webkit-scrollbar': {
                            backgroundColor: 'rgba(174, 174, 174, 0.5)',
                            visibility: 'visible', // hover 시 스크롤바가 보이도록 설정
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,,0, 0.0)', // 스크롤바 색상
                            borderRadius: '10px', // 둥근 스크롤바
                        },
                        '&:hover::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgb(88, 88, 88)', // hover 시 색상 변경
                        },
                    }}>
                    <Collapse
                        in={selected_category_id === category_id}
                        timeout={360}
                        unmountOnExit>
                        <List
                            sx={{
                                margin: 0,
                                padding: 0,
                            }}>
                            {submenu_bar}
                        </List>
                    </Collapse>
                </Box>
            </Box>
        );
    };
    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                border: '1px solid red',
            }}>
            {create_menu()}
        </Box>
    );
};

export default MenuItemBar2;
