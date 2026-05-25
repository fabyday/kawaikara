import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    CssBaseline,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    createTheme,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import UpdateRoundedIcon from '@mui/icons-material/UpdateRounded';
import Favorites from './favorites';
import { KawaiMenuComponent, menu_state } from './states';
import { KawaiConfig } from '../../main/definitions/setting_types';

const utilityActions = [
    {
        id: 'menu_preference',
        label: 'Preferences',
        icon: <SettingsRoundedIcon />,
    },
    {
        id: 'menu_bgtaskview',
        label: 'Tasks',
        icon: <DownloadRoundedIcon />,
    },
    {
        id: 'menu_checkupdate',
        label: 'Updates',
        icon: <UpdateRoundedIcon />,
    },
    {
        id: 'menu_info',
        label: 'Info',
        icon: <InfoRoundedIcon />,
    },
];

const App: React.FC = () => {
    const [
        fetch,
        category_map,
        favorites_list,
        menu_map,
        current_category,
        set_current_category,
    ] = menu_state((state) => [
        state.fetch,
        state.category_map,
        state.favorites,
        state.menu_map,
        state.current_category,
        state.set_current_category,
    ]);

    const [darkmode, setDarkMode] = useState(false);
    const [version, setVersion] = useState('');

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: darkmode ? 'dark' : 'light',
                    primary: {
                        main: '#12a88a',
                    },
                    secondary: {
                        main: '#e84d72',
                    },
                    background: {
                        default: darkmode ? '#141414' : '#f4f6f8',
                        paper: darkmode ? '#1f2023' : '#ffffff',
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
        [darkmode],
    );

    useEffect(() => {
        fetch();
        window.KAWAI_API.etc.version().then((appVersion: string) => {
            setVersion(appVersion);
        });
        window.KAWAI_API.preference
            .load_config()
            .then((config: KawaiConfig) => {
                setDarkMode((config?.general as any)?.dark_mode?.value ?? false);
            });

        window.KAWAI_API.preference.notify_config_update(async () => {
            const config = await window.KAWAI_API.preference.load_config();
            setDarkMode((config?.general as any)?.dark_mode?.value ?? false);
        });
        window.KAWAI_API.menu.notify_menu_update(fetch);
    }, [fetch]);

    const categories = useMemo(
        () => Array.from(category_map.values()),
        [category_map],
    );

    const selectedCategoryId =
        current_category ?? categories.find((category) => category.id)?.id ?? null;

    const selectedItems = useMemo(() => {
        if (selectedCategoryId === null) {
            return new Array<KawaiMenuComponent>();
        }
        return Array.from(menu_map.get(selectedCategoryId)?.values() ?? []);
    }, [menu_map, selectedCategoryId]);

    const visibleFavorites = favorites_list ?? [];

    const launch = async (id: string) => {
        await window.KAWAI_API.menu.select_menu_item(id);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box
                sx={{
                    minHeight: '100vh',
                    width: '100vw',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                <Box
                    component="header"
                    sx={{
                        height: 72,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 2, sm: 3 },
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        flexShrink: 0,
                    }}>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{ minWidth: 0 }}>
                        <Box
                            component="img"
                            src="kawai://resources/icons/kawaikara_banner.png"
                            alt="Kawaikara"
                            sx={{
                                width: 44,
                                height: 44,
                                objectFit: 'contain',
                                flexShrink: 0,
                            }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    whiteSpace: 'nowrap',
                                }}>
                                Kawaikara
                            </Typography>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block' }}>
                                {version ? `v${version}` : 'Loading'}
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                        {utilityActions.map((action) => (
                            <Tooltip key={action.id} title={action.label} arrow>
                                <IconButton
                                    aria-label={action.label}
                                    onClick={() => {
                                        launch(action.id);
                                    }}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                    }}>
                                    {action.icon}
                                </IconButton>
                            </Tooltip>
                        ))}
                    </Stack>
                </Box>

                <Box
                    component="main"
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '280px 1fr' },
                        gap: { xs: 2, lg: 3 },
                        p: { xs: 2, sm: 3 },
                    }}>
                    <Box
                        sx={{
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}>
                        <Box>
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mb: 1 }}>
                                <StarRoundedIcon
                                    color="secondary"
                                    fontSize="small"
                                />
                                <Typography variant="subtitle2" fontWeight={800}>
                                    Favorites
                                </Typography>
                            </Stack>
                            <Favorites
                                favorites_list={visibleFavorites}
                                onClicked={launch}
                            />
                        </Box>

                        <Box>
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mb: 1 }}>
                                <AppsRoundedIcon color="primary" fontSize="small" />
                                <Typography variant="subtitle2" fontWeight={800}>
                                    Categories
                                </Typography>
                            </Stack>
                            <Stack spacing={1}>
                                {categories.map((category) => (
                                    <Button
                                        key={category.id}
                                        variant={
                                            selectedCategoryId === category.id
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                        color={
                                            selectedCategoryId === category.id
                                                ? 'primary'
                                                : 'inherit'
                                        }
                                        onClick={() => {
                                            set_current_category(category.id);
                                        }}
                                        sx={{
                                            justifyContent: 'space-between',
                                            height: 40,
                                            borderRadius: 2,
                                            textTransform: 'none',
                                        }}>
                                        <span>{category.name ?? category.id}</span>
                                        <Chip
                                            size="small"
                                            label={
                                                menu_map.get(category.id)?.size ?? 0
                                            }
                                            sx={{
                                                height: 22,
                                                minWidth: 30,
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    </Button>
                                ))}
                            </Stack>
                        </Box>
                    </Box>

                    <Box sx={{ minWidth: 0, minHeight: 0 }}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={1.5}
                            sx={{ mb: 2 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h5" fontWeight={850}>
                                    {selectedCategoryId ?? 'Services'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {selectedItems.length} items
                                </Typography>
                            </Box>
                        </Stack>

                        <Box
                            sx={{
                                height: 'calc(100vh - 144px)',
                                overflow: 'auto',
                                pr: 0.5,
                                '&::-webkit-scrollbar': {
                                    width: 8,
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: 'rgba(120,120,120,0.35)',
                                    borderRadius: 8,
                                },
                            }}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                                        md: 'repeat(auto-fill, minmax(180px, 1fr))',
                                    },
                                    gap: 1.5,
                                    pb: 1,
                                }}>
                                {selectedItems.map((item) => (
                                    <Button
                                        key={item.id}
                                        onClick={() => {
                                            launch(item.id);
                                        }}
                                        sx={{
                                            height: 92,
                                            p: 1.5,
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                            color: 'text.primary',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            gap: 1.25,
                                            textTransform: 'none',
                                            overflow: 'hidden',
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                bgcolor: 'action.hover',
                                            },
                                        }}>
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                flexShrink: 0,
                                                display: 'grid',
                                                placeItems: 'center',
                                                borderRadius: 2,
                                                bgcolor: 'action.hover',
                                            }}>
                                            {item.favicon ? (
                                                <img
                                                    src={item.favicon}
                                                    alt=""
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        objectFit: 'contain',
                                                    }}
                                                />
                                            ) : (
                                                <AppsRoundedIcon fontSize="small" />
                                            )}
                                        </Box>
                                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                            <Typography
                                                variant="body2"
                                                fontWeight={800}
                                                noWrap>
                                                {item.name ?? item.id}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                noWrap
                                                sx={{ display: 'block' }}>
                                                {item.id}
                                            </Typography>
                                        </Box>
                                    </Button>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </ThemeProvider>
    );
};

export default App;
