import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import {
    List,
    ListSubheader,
    ListItemIcon,
    ListItemText,
    IconButton,
    Slide,
    ListItem,
    ListItemButton,
    Button,
} from '@mui/material';
import KListItemButton from './KListItemButton';
import StarSharpIcon from '@mui/icons-material/StarSharp';
import { KawaiMenuComponent } from './states';
import CustomButton, { Stat } from './testButton';
import CustomButtonComponent from './testButton';
import StatFullTemplate from './testButton';

type props = {
    menu_item: KawaiMenuComponent[];
};

const SubmenuBar = ({ menu_item }: props) => {
    const [sliderVal, setSliderVal] = useState(0);
    const [show, setShow] = useState(true);

    const def = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const value = menu_item.map((v, i) => {
        console.log(i.toString() + v.id);
        return (
            <Slide key={v.id} direction="right" in={true} timeout={500}>
                <KListItemButton sx={{width : "100%"}}>
                    <ListItemIcon sx={{ width: 55, height: 55 }}>
                        {/* </img> */}

                        {typeof v.favicon !== 'undefined' ? (
                            <img src="https://www.netflix.com/favicon.ico" />
                        ) : (
                            // <img src={v.favicon} />
                            <div></div>
                        )}
                    </ListItemIcon>
                    <ListItemText primary={v.id} />
                    <IconButton onMouseUp={def} onClick={def} onMouseDown={def}>
                        <StarSharpIcon></StarSharpIcon>
                    </IconButton>
                </KListItemButton>
            </Slide>
        );
    });

    const reval = (
        <Box
            sx={{
                height: '100%', // 슬라이더 값에 따라 최대 높이 설정
                width : "20em",
                overflowY: 'scroll',
                marginLeft: 1,
                borderRadius: 1,
                bgcolor: 'white',
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
                    bgcolor: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',

                    // height : "100%"
                }}

                // component="nav"
                // aria-labelledby="nested-list-subheader"
                // subheader={
                //     <ListSubheader component="div" id="nested-list-subheader">
                //         <Box
                //             sx={{
                //                 textAlign: 'center',
                //                 color: 'white',
                //                 bgcolor: 'primary.dark',
                //             }}>
                //             Sub
                //         </Box>
                //     </ListSubheader>
                // }
            >
                {value.length !== 0 ? (
                    value
                ) : (
                            <ListItemText sx={{width : 300, height:"100%"}}/>
                )}
            </List>
        </Box>
    );

    return reval;
};

export default SubmenuBar;
