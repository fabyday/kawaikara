import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import {
    List,
    ListSubheader,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Button,
    IconButton,
    SvgIcon,
} from '@mui/material';

const Favorites = (favorites_list : any[]) => {
   
    let reval = (
        <Box
            sx={{
                display: 'flex',
                width : "99%",
                flexDirection: 'row',
                margin : "2px",
                bgcolor: 'rgb(29, 211, 165)',
                gap: '2',
                boxShadow: 'inset -2px -2px 3px rgba(0, 0, 0, 0.5), 0px 6px 10px rgba(0, 0, 0, 0.3)', 
                
                minHeight : '48px',
                alignItems : "cetner",
                borderRadius :'10px',
                boxSizing: 'border-box',   // 패딩과 보더를 포함한 크기 계산

            }}>
                <IconButton 
                
                sx={{
                    width: "48px",  
                    height: "48px", 
                    padding: "3px", 
                  }}
                >
                    <img
                    src="https://www.netflix.com/favicon.ico"
                    alt="Netflix Icon"
                    style={{
                      width: '100%',   // 이미지 너비를 IconButton에 맞추기
                      height: '100%',  // 이미지 높이를 IconButton에 맞추기
                      objectFit: 'contain', // 이미지 비율을 유지하면서 크기 맞추기
                    }}/>
                </IconButton>
        </Box>
    );
    return reval;
};

export default Favorites;
