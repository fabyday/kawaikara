import { Box, LinearProgress, List } from '@mui/material';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { KawaiProgressBar } from './progressbar';
import { bgTasks } from './states';

const App: React.FC = () => {
    const [bgtask_map, fetch_task, pause, resume, delete_task] = bgTasks(
        (state) => [
            state.bgtask_map,
            state.fetch,
            state.pause,
            state.resume,
            state.delete,
        ],
    );
    useEffect(() => {
        fetch_task().then(() => {
            console.log('fetched');
        });
        // window.KAWAI_API.custom.custom_callback_recv('add', () => {});
        // window.KAWAI_API.custom.custom_callback_recv('delete');
        // window.KAWAI_API.custom.custom_callback_recv('update');
        // window.KAWAI_API.custom.custom_callback_recv('pause');
        // window.KAWAI_API.custom.custom_callback_recv('resume');
    }, []);

    const list_map = [...bgtask_map.entries()].map(([values, compoent]) => {
        return (
            <KawaiProgressBar
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
        );
    });

    //
    // return (
    //     <Box>
    //         <List>{list_map}</List>
    //     </Box>
    // );
    return (
        <Box>
            <List>
                <KawaiProgressBar
                    id={'test'}
                    filename={'filename'}
                    progressValue={10}
                    onPaused={async (id) => {
                        return true;
                    }}
                    onResumed={async (id) => {
                        return true;
                    }}
                    onDelete={async (id) => {
                        return true;
                    }}
                />
            </List>
        </Box>
    );
};

export default App;
