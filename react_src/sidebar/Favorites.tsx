import Box from '@mui/material/Box';
import { IconButton, Grid, Paper, Typography } from '@mui/material';

const Favorites = (favorites_list: any[]) => {
    let reval = (
        <Grid container spacing={0}>
            <Grid item xs={1}>
                <Paper
                elevation={5} sx={{ padding: 2, width: '300px', margin: '20px auto' }}
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
                    
                </Paper>
            </Grid>

            <Grid item xs={8}></Grid>
            <Grid item xs={12}>
                <Box
                    sx={{
                        display: 'flex',
                        width: '99%',
                        flexDirection: 'row',
                        margin: '0px 2px 2px 2px',
                        bgcolor: 'rgb(29, 211, 165)',
                        gap: '2',
                        boxShadow:
                            'inset -2px -2px 3px rgba(0, 0, 0, 0.5), 0px 6px 10px rgba(0, 0, 0, 0.3)',

                        minHeight: '48px',
                        alignItems: 'center',
                        borderRadius: '0px 10px 10px 10px',
                        boxSizing: 'border-box', // 패딩과 보더를 포함한 크기 계산
                    }}>
                    <IconButton
                        sx={{
                            width: '48px',
                            height: '48px',
                            padding: '3px',
                        }}>
                        <img
                            src="https://www.netflix.com/favicon.ico"
                            alt="Netflix Icon"
                            style={{
                                width: '100%', // 이미지 너비를 IconButton에 맞추기
                                height: '100%', // 이미지 높이를 IconButton에 맞추기
                                objectFit: 'contain', // 이미지 비율을 유지하면서 크기 맞추기
                            }}
                        />
                    </IconButton>
                </Box>
            </Grid>
        </Grid>
    );
    return reval;
};

export default Favorites;
