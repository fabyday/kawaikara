import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import {
    List,
    ListItemIcon,
    ListItemText,
    IconButton,
    Slide,
    Typography,
} from '@mui/material';
import KListItemButton from './KListItemButton';
import StarSharpIcon from '@mui/icons-material/StarSharp';
import { isBase64, KawaiMenuComponent } from './states';

type props = {
    menu_item: KawaiMenuComponent[];
    onClicked: (id: string) => void;
    onFavoritesClick: (id: string, current_fav_state: boolean) => void;
};

const SubmenuBar = ({ menu_item, onClicked, onFavoritesClick }: props) => {
    const [sliderVal, setSliderVal] = useState(0);
    const [show, setShow] = useState(true);

    const def = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const value = menu_item.map((v, i) => {
        // console.log(i.toString() + v.id);
        // console.log(i.toString() + v.name);
        // console.log(i.toString() + 'fav' + v.favorite);
        return (
            <Slide key={v.id} direction="right" in={true} timeout={500}>
                <KListItemButton
                    sx={{
                        bgcolor: 'white',
                        width: '100%',
                        margin: '0 0 0 0',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'stretch',
                        '&:hover': {
                            backgroundColor: 'rgba(200,200,200,1.0)', // 마우스 올렸을 때 배경색 유지
                            opacity: 1, // 투명도도 유지
                        },
                    }}>
                    <Box
                        sx={{
                            padding: 0,
                            margin: 0,
                            justifyContent: 'space-between',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            flexGrow: 1,
                        }}>
                        <Box
                            onClick={(e) => {
                                onClicked(v.id);
                            }}
                            sx={{
                                height: '100%',
                                justifyContent: 'center',
                                flexGrow: 1, // 🔥 남은 공간을 채움
                                display: 'flex',
                                alignItems: 'center',
                            }}>
                            <ListItemIcon sx={{ width: 28, height: 28 }}>
                                {/* </img> */}

                                {v.favicon !== '' ? (
                                    // isBase64(v.favicon!) ? <img src={`data:image/png;base64,${v.favicon!}`}/> :
                                    <img src={v.favicon} />
                                ) : (
                                    <div></div>
                                )}
                            </ListItemIcon>
                            <ListItemText primary={v.name} />
                        </Box>
                        <Box
                            onMouseUp={def}
                            onMouseDown={def}
                            onClick={def}
                            sx={{
                                height: '100%',
                            }}>
                            <IconButton
                                // style={{ marginLeft: 'auto' }}
                                size="small"
                                onMouseUp={def}
                                onClick={(e) => {
                                    def(e);
                                    onFavoritesClick(v.id, v.favorite ?? false);
                                }}
                                onMouseDown={def}>
                                <StarSharpIcon
                                    style={{
                                        color: v.favorite ? 'gold' : 'gray',
                                    }}></StarSharpIcon>
                            </IconButton>
                        </Box>
                    </Box>
                </KListItemButton>
            </Slide>
        );
    });

    const reval = (
        <Box
            sx={{
                height: '100%', // 슬라이더 값에 따라 최대 높이 설정
                width: '20em',
                overflowY: 'auto',
                marginLeft: 1,
                borderRadius: 1,
                bgcolor: 'transparent',
                position: 'relative',
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
            <List
                sx={{
                    maxHeight: '100%', // 슬라이더 값에 따라 최대 높이 설정

                    width: '100%',
                    maxWidth: 360,
                    // bgcolor: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',

                    // height : "100%"
                }}>
                {value.length !== 0
                    ? value
                    : undefined
                      // <ListItemText sx={{ width: 300, height: '100%' }} />
                }
            </List>
        </Box>
    );

    return reval;
};

export default SubmenuBar;
