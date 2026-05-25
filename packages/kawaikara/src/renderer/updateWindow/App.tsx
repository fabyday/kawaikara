import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    LinearProgress,
    Stack,
    Typography,
    createTheme,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import UpdateRoundedIcon from '@mui/icons-material/UpdateRounded';

type KawaiUpdateState = {
    stage:
        | 'idle'
        | 'checking'
        | 'available'
        | 'downloading'
        | 'downloaded'
        | 'not_available'
        | 'cancelled'
        | 'error';
    title: string;
    message: string;
    version?: string;
    percent?: number;
    bytesPerSecond?: number;
    transferred?: number;
    total?: number;
    canDownload?: boolean;
    canCancel?: boolean;
    canInstall?: boolean;
    canClose?: boolean;
};

const initialState: KawaiUpdateState = {
    stage: 'idle',
    title: 'Update',
    message: 'Waiting for update activity.',
    canClose: true,
};

function formatBytes(value?: number) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const App: React.FC = () => {
    const [state, setState] = useState<KawaiUpdateState>(initialState);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: 'dark',
                    primary: {
                        main: '#16b99a',
                    },
                    secondary: {
                        main: '#f05f7f',
                    },
                    background: {
                        default: 'rgba(8, 10, 12, 0.78)',
                        paper: '#191d22',
                    },
                },
                shape: {
                    borderRadius: 8,
                },
                typography: {
                    fontFamily:
                        'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                },
            }),
        [],
    );

    useEffect(() => {
        window.KAWAI_API.update.status().then(setState);
        window.KAWAI_API.update.notify_status((nextState: KawaiUpdateState) => {
            setState(nextState);
        });
    }, []);

    const progress =
        typeof state.percent === 'number'
            ? Math.min(100, Math.max(0, state.percent))
            : undefined;

    return (
        <ThemeProvider theme={theme}>
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: 'background.default',
                    display: 'grid',
                    placeItems: 'center',
                    px: 2,
                    boxSizing: 'border-box',
                }}>
                <Box
                    sx={{
                        width: 'min(560px, 92vw)',
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 2,
                        boxShadow: '0 24px 80px rgba(0,0,0,0.42)',
                        p: { xs: 2.5, sm: 3 },
                    }}>
                    <Stack spacing={2.25}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'rgba(22, 185, 154, 0.16)',
                                    color: 'primary.main',
                                    flexShrink: 0,
                                }}>
                                <UpdateRoundedIcon />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h6" fontWeight={850} noWrap>
                                    {state.title}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.25 }}>
                                    {state.message}
                                </Typography>
                            </Box>
                        </Stack>

                        {state.version ? (
                            <Typography variant="body2" color="text.secondary">
                                Version {state.version}
                            </Typography>
                        ) : null}

                        <Box>
                            <LinearProgress
                                variant={
                                    typeof progress === 'number'
                                        ? 'determinate'
                                        : 'indeterminate'
                                }
                                value={progress}
                                sx={{
                                    height: 10,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                }}
                            />
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mt: 1 }}>
                                <Typography
                                    variant="caption"
                                    color="text.secondary">
                                    {typeof progress === 'number'
                                        ? `${progress.toFixed(1)}%`
                                        : state.stage}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary">
                                    {formatBytes(state.transferred)} /{' '}
                                    {formatBytes(state.total)}
                                </Typography>
                            </Stack>
                        </Box>

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            justifyContent="flex-end">
                            {state.canClose ? (
                                <Button
                                    startIcon={<CloseRoundedIcon />}
                                    color="inherit"
                                    variant="outlined"
                                    onClick={() => {
                                        window.KAWAI_API.update.close();
                                    }}>
                                    Close
                                </Button>
                            ) : null}
                            {state.canCancel ? (
                                <Button
                                    startIcon={<StopRoundedIcon />}
                                    color="secondary"
                                    variant="outlined"
                                    onClick={() => {
                                        window.KAWAI_API.update.cancel();
                                    }}>
                                    Cancel
                                </Button>
                            ) : null}
                            {state.canDownload ? (
                                <Button
                                    startIcon={<DownloadRoundedIcon />}
                                    variant="contained"
                                    onClick={() => {
                                        window.KAWAI_API.update.start_download();
                                    }}>
                                    Download
                                </Button>
                            ) : null}
                            {state.canInstall ? (
                                <Button
                                    startIcon={<RestartAltRoundedIcon />}
                                    variant="contained"
                                    onClick={() => {
                                        window.KAWAI_API.update.install();
                                    }}>
                                    Restart
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>
                </Box>
            </Box>
        </ThemeProvider>
    );
};

export default App;
