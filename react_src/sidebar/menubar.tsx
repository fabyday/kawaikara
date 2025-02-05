import React, { ReactEventHandler, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import {
    List,
    ListSubheader,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    IconButton,
} from '@mui/material';
import KListItemButton from './KListItemButton';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import StarSharpIcon from '@mui/icons-material/StarSharp';
import { isBase64, KawaiMenuComponent } from './states';
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
    const def = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const create_menu = () => {
        const flat_cat = category_list.map((categoryComponent) => {
            if (categoryComponent.id) {
                return create_submenu(
                    categoryComponent.id,
                    (1 / category_list.length) * 100,
                );
            }
        });

        return (
            <List
                sx={{
                    height: '100%',
                    width: '100%',
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



    const create_submenu = (category_id: string, length?: number) => {
        const submenu_bar = menu_item.map((item) => {
            return (
                <ListItemButton
                    key={`${category_id}_${item.id}`}
                    className={'list-button'}
                    sx={{
                        bgcolor: 'rgb(186, 186, 255)',
                        '&:hover': {
                            backgroundColor: 'rgb(214, 214, 252)', // hover 시 배경색 변경
                        },
                    }}
                    onClick={() => {
                        onMenuClick(item.id);
                    }}>
                    <ListItemIcon
                        key={`${category_id}_${item.id}_icon`}
                        sx={{ width: 28, height: 28 }}>
                        {/* </img> */}

                        {item.favicon !== '' ? (
                            // isBase64(v.favicon!) ? <img src={`data:image/png;base64,${v.favicon!}`}/> :
                            <img src={item.favicon} />
                        ) : (
                            <div></div>
                        )}
                    </ListItemIcon>
                    <ListItemText
                        key={`${category_id}_${item.id}_text`}
                        sx={{
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                        }}
                        primary={item.name}
                    />
                    <IconButton
                        key={`${category_id}_${item.id}_iconbutton`}
                        size="small"
                        onMouseUp={def}
                        onClick={(e) => {
                            def(e);
                            onFavoritesClick(item.id, item.favorite ?? false);
                        }}
                        onMouseDown={def}>
                        <StarSharpIcon
                            style={{
                                color: item.favorite ? 'gold' : 'gray',
                            }}
                        />
                    </IconButton>
                </ListItemButton>
            );
        });

        return (
            <Box
                key={`${category_id}_root`}
                sx={{
                    // border: '1px solid blue',
                    height: '100%',
                    width: `${length}%`,
                    bgcolor: 'rgb(186, 186, 255)',
                    display: 'flex',
                    flexShrink: 0, // 자식 요소의 크기에 맞춰 부모 너비 조정
                    flexGrow: 0, // 자식 요소 크기에 맞춰 크기 조정

                    flexDirection: 'column',
                }}>
                <Box
                    sx={{
                        bgcolor: 'blue',
                        flexShrink: 0,
                        border: '1px solid gray',
                    }}>
                    <ListSubheader
                        key={`${category_id}`}
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1000,
                            textOverflow: 'ellipsis',
                            // minWidth : 100,
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
                        // border: '1px solid red',

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
                                width: '100%',
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
                borderRadius: '10px',
                overflow: 'hidden',
                // border: '1px solid red',
            }}>
            {create_menu()}
        </Box>
    );
};

export default MenuItemBar2;
