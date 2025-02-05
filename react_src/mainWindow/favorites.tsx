import Box from '@mui/material/Box';
import { IconButton, Grid, Paper, Typography, Tooltip } from '@mui/material';
import { KawaiMenuComponent } from './states';

type props = {
    favorites_list: KawaiMenuComponent[];
    onClicked?: (id: string) => void;
};

const Favorites = ({ favorites_list, onClicked }: props) => {
    let reval = (
        <Grid
            onClick={(e) => {
                e.stopPropagation();
            }}
            container
            spacing={0}>
            <Grid item xs={1}>
                {/* <Paper
                    elevation={5}
                    sx={{ padding: 2, width: '300px', margin: '20px auto' }}
                    // sx={{
                    //     display: 'flex',
                    //     width: '99%',
                    //     flexDirection: 'row',
                    //     margin: '0px 2px 0px 2px',

                    //     bgcolor: 'rgb(29, 211, 165)',
                    //     textAlign : "center",
                    //     minHeight: '48px',
                    //     alignItems: 'center',
                    //     justifyContent : "center",
                    //     borderRadius: '15px 30px 0px 0px',
                    // }}
                >
                    <Typography>Favorites</Typography>
                </Paper> */}
            </Grid>

            <Grid item xs={8}></Grid>
            <Grid item xs={12}>
                <Paper
                    sx={{
                        display: 'flex',
                        width: '99%',
                        flexDirection: 'row',
                        margin: '2px 2px 2px 2px',
                        bgcolor: 'rgba(240,240,240, 1.0)',
                        gap: '2',
                        padding: '2',
                        // boxShadow:
                        //     'inset -2px -2px 3px rgba(0, 0, 0, 0.5), 0px 6px 10px rgba(0, 0, 0, 0.3)',

                        minHeight: '48px',
                        alignItems: 'center',
                        borderRadius: '10px 10px 10px 10px',

                        overflowX: 'auto',
                        boxSizing: 'border-box', // 패딩과 보더를 포함한 크기 계산
                        '&::-webkit-scrollbar': {
                            height: '10px', // 스크롤바의 너비
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
                    {favorites_list.map((component) => {
                        return (
                            <Tooltip title={component.name} arrow>
                                <IconButton
                                    onClick={(e) => {
                                        typeof onClicked !== 'undefined'
                                            ? onClicked(component.id)
                                            : (() => {})();
                                    }}
                                    sx={{
                                        width: '28px',
                                        height: '28px',
                                        padding: '3px',
                                        margin: '3px',
                                    }}>
                                    <img
                                        src={component.favicon}
                                        alt="Netflix Icon"
                                        style={{
                                            width: '100%', // 이미지 너비를 IconButton에 맞추기
                                            height: '100%', // 이미지 높이를 IconButton에 맞추기
                                            objectFit: 'contain', // 이미지 비율을 유지하면서 크기 맞추기
                                        }}
                                    />
                                </IconButton>
                            </Tooltip>
                        );
                    })}
                </Paper>
            </Grid>
        </Grid>
    );
    return reval;
};

export default Favorites;
