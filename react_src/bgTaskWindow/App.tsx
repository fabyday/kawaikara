import {
    Box,
    colors,
    Divider,
    LinearProgress,
    List,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { KawaiProgressBar } from './progressbar';
import { bgTasks } from './states';
import { KawaiPrgoress } from '../../typescript_src/definitions/bg_task';

const App: React.FC = () => {
    const [
        bgtask_map,
        update_task,
        fetch_task,
        pause,
        resume,
        delete_task,
        created,
        completed,
    ] = bgTasks((state) => [
        state.bgtask_map,
        state.update,
        state.fetch,
        state.pause,
        state.resume,
        state.delete,
        state.created,
        state.completed,
    ]);

    useEffect(() => {
        console.log('changed ', bgtask_map);
    }, [bgtask_map]);
    useEffect(() => {
        console.log('init');
        fetch_task().then(() => {
            console.log('fetched');
        });

        window.KAWAI_API.custom.custom_callback_recv(
            'bg:stdout',
            (data: string) => {
                // console.log("recv")
                // console.log(data);
            },
        );
        window.KAWAI_API.custom.custom_callback_recv(
            'bg:progress',
            async (data: KawaiPrgoress) => {
                await update_task(data);

                // console.log(data);s
            },
        );
        window.KAWAI_API.custom.custom_callback_recv(
            'bg:tasks:created',
            async (id: string) => {
                console.log('created task');
                const res = await window.KAWAI_API.custom.custom_invoke(
                    'bg:tasks',
                    id,
                );
                console.log(res);
                await created({
                    filename: res.result[0].name,
                    id: id,
                    states: 'running',
                    value: {
                        eta_minutes: 0,
                        eta_seconds: 0,
                        progress: 0,
                        speed: 0,
                        total_size: 0,
                    },
                });
            },
        );
        window.KAWAI_API.custom.custom_callback_recv(
            'bg:tasks:completed',
            (id: string) => {
                completed({
                    filename: '',
                    id: id,
                    states: 'finished',
                    value: {
                        eta_minutes: 0,
                        eta_seconds: 0,
                        progress: 0,
                        speed: 0,
                        total_size: 0,
                    },
                });
                console.log('completed task');
            },
        );
        // window.KAWAI_API.custom.custom_callback_recv('delete');
        // window.KAWAI_API.custom.custom_callback_recv('update');
        // window.KAWAI_API.custom.custom_callback_recv('pause');
        // window.KAWAI_API.custom.custom_callback_recv('resume');
    }, []);

    const list_map = [...bgtask_map.entries()].map(
        ([values, compoent], index) => {
            return (
                <Box>
                    <KawaiProgressBar
                        index={index + 1}
                        key={compoent.id + '_progress'}
                        id={compoent.id}
                        filename={compoent.filename}
                        progressValue={compoent.value}
                        onPaused={async (id) => {
                            return await pause(id);
                        }}
                        onResumed={async (id) => {
                            return await resume(id);
                        }}
                        onDelete={async (id) => {
                            return await delete_task(id);
                        }}
                    />
                    <Divider />
                </Box>
            );
        },
    );

    return (
        <Box>
            <Box
                sx={{
                    margin: "0",
                    outlineOffset : "-3px",
                    padding: 0,
                    height: '3em',
                    bgcolor: 'skyblue',
                    alignContent: 'center',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    outline: "3px solid rgb(90, 167, 250)", // 윤곽선 추가 (파란색)
                }}>
                <Typography
                    sx={{
                        color: '#4169E1',
                        fontVariant: 'h4',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                    }}>
                    Kawai Background Tasks
                </Typography>
            </Box>
            <Box sx={{ margin: 0, padding: 0 }}>
                <List sx={{ margin: 0, padding: 0 }}>
                    {[<Divider />, ...list_map]}
                </List>
            </Box>
        </Box>
    );
};

export default App;
