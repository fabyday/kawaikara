import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import { KawaiMenuComponent } from './states';

type props = {
    favorites_list: KawaiMenuComponent[];
    onClicked?: (id: string) => void;
};

const Favorites = ({ favorites_list, onClicked }: props) => {
    return (
        <Box
            onClick={(event) => {
                event.stopPropagation();
            }}
            sx={{
                width: '100%',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                overflowX: 'auto',
                overflowY: 'hidden',
                px: 0.5,
                '&::-webkit-scrollbar': {
                    height: 8,
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(120,120,120,0.35)',
                    borderRadius: 8,
                },
            }}>
            {favorites_list.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No favorites yet
                </Typography>
            ) : (
                <Stack direction="row" spacing={1}>
                    {favorites_list.map((component) => (
                        <Tooltip key={component.id} title={component.name} arrow>
                            <IconButton
                                onClick={() => {
                                    onClicked?.(component.id);
                                }}
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    },
                                }}>
                                {component.favicon ? (
                                    <img
                                        src={component.favicon}
                                        alt=""
                                        style={{
                                            width: 26,
                                            height: 26,
                                            objectFit: 'contain',
                                        }}
                                    />
                                ) : (
                                    <AppsRoundedIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>
                    ))}
                </Stack>
            )}
        </Box>
    );
};

export default Favorites;
