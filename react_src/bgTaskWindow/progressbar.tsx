import { Box, IconButton, LinearProgress, Typography } from '@mui/material';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { KawaiProgressValue } from './states';
import { KawaiPrgoress } from '../../typescript_src/definitions/bg_task';

type props = {
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
                    alignItems: 'center',
                    mr: 2,
                    ml: 2,
                    pl: 2,
                    pr: 2,
                }}>
                <Box sx={{ minWidth: '35' }}>
                    <IconButton
                        onClick={async (e) => {
                            if (isPaused) {
                                const paused = await prop.onPaused(prop.id);
                                setPaused(paused ? true : false);
                            } else {
                                const resumed = await prop.onResumed(prop.id);
                                setPaused(resumed ? false : true);
                            }
                        }}>
                        {isPaused ? (
                            <PlayCircleFilledWhiteIcon />
                        ) : (
                            <PauseCircleIcon />
                        )}
                    </IconButton>
                </Box>
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
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
                <Box sx={{ minWidth: '6em', width: '30%' }}>
                    <LinearProgress
                        variant="determinate"
                        value={prop.progressValue.progress}
                    />
                </Box>
                <Box sx={{ alignItems: 'center', margin: 1, minWidth: '35' }}>
                    <Typography>{prop.progressValue.progress.toFixed(1).padStart(5, " ")}%</Typography>
                </Box>
                <Box sx={{ alignItems: 'center', margin: 1, minWidth: '35' }}>
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
