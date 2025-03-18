import {
    Box,
    Divider,
    IconButton,
    LinearProgress,
    Typography,
} from '@mui/material';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { KawaiProgressValue } from './states';
import { KawaiPrgoress } from '../../typescript_src/definitions/bg_task';

type props = {
    index: number;
    id: string;
    filename: string;
    progressValue: KawaiProgressValue;
    onPaused: (id: string) => Promise<boolean>;
    onResumed: (id: string) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
};
export const KawaiProgressBar = (prop: props) => {
    const [isPaused, setPaused] = useState(false);

    const bar = (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    bgcolor: '#F0F8FF', // alice blue

                    alignItems: 'center',
                    // mr: 2,
                    // ml: 2,
                    pl: 1,
                    pr: 1,
                }}>
                <Box
                    sx={{
                        minWidth: '35px',
                        justifyContent: 'center',
                        alignItems: 'left',
                    }}>
                    <Typography
                        sx={{
                            minWidth: '35',
                            display: 'flex',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                        {prop.index}
                    </Typography>
                </Box>
                <Divider
                    sx={{ ml: 1, mr: 1 }}
                    orientation="vertical"
                    flexItem
                />
                <Box
                    sx={{
                        minWidth: '35px',
                        height: '35px',
                        display: 'inline-block',
                        position: 'relative',
                        // justifyContent: 'center',
                        // alignItems: 'center',
                    }}>
                    <Box
                        sx={{
                            visibility: !isPaused ? 'visible' : 'hidden',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            borderTop: '4px solid #007BFF',
                            borderLeft: '4px solid #007BFF',
                            // border: '4px solid #007BFF',
                            animation: !isPaused
                                ? 'rotate 1.5s linear infinite'
                                : 'none',
                            '@keyframes rotate': {
                                '0%': {
                                    transform: 'rotate(0deg)',
                                },
                                '100%': {
                                    transform: 'rotate(360deg)',
                                },
                            },
                        }}
                    />
                    <IconButton
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                        onClick={async (e) => {
                            if (isPaused) {
                                const resumed = await prop.onResumed(prop.id);
                                setPaused(resumed ? false : true);
                            } else {
                                const paused = await prop.onPaused(prop.id);
                                setPaused(paused ? true : false);
                            }
                        }}>
                        {isPaused ? (
                            <PlayCircleFilledWhiteIcon />
                        ) : (
                            <PauseCircleIcon />
                        )}
                    </IconButton>
                </Box>
                <Divider
                    sx={{ ml: 1, mr: 1 }}
                    orientation="vertical"
                    flexItem
                />
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '70%',
                    }}>
                    <Typography
                        sx={{
                            flexGrow: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            wordBreak: 'break-all',
                        }}>
                        {prop.filename}
                    </Typography>
                </Box>
                <Divider
                    sx={{ ml: 1, mr: 1 }}
                    orientation="vertical"
                    flexItem
                />

                <Box
                    sx={{
                        width: '30%',
                        bgcolor: 'red',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                    <LinearProgress
                        sx={{ width: '100%' }}
                        variant="determinate"
                        value={prop.progressValue.progress}
                    />
                </Box>
                <Box sx={{ alignItems: 'center', margin: 1, minWidth: '3em' }}>
                    <Typography sx={{ whiteSpace: 'pre' }}>
                        {prop.progressValue.progress
                            .toFixed(1)
                            .padStart(6, ' ')}
                        %
                    </Typography>
                </Box>

                <Divider
                    sx={{ ml: 1, mr: 1 }}
                    orientation="vertical"
                    flexItem
                />

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: 1,
                        minWidth: '35',
                    }}>
                    <IconButton
                        onClick={async (e) => {
                            const result = await prop.onDelete(prop.id);
                        }}>
                        <DeleteIcon />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
    return bar;
};
