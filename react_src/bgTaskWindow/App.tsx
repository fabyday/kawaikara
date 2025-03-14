import { Box, LinearProgress, List } from '@mui/material';
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


    useEffect(()=>{
        console.log("changed ", bgtask_map)
    }, [bgtask_map])
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
            (id: string) => {
                console.log('created task');
                created({
                    filename: '',
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

    const list_map = [...bgtask_map.entries()].map(([values, compoent]) => {
        return (
            <KawaiProgressBar
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
        );
    });

    return (
        <Box>
            <List>{list_map}</List>
        </Box>
    );
    // return (
    //     <Box>
    //         <List>
    //             <KawaiProgressBar
    //                 id={'test'}
    //                 filename={'filename'}
    //                 progressValue={10}
    //                 onPaused={async (id) => {
    //                     return true;
    //                 }}
    //                 onResumed={async (id) => {
    //                     return true;
    //                 }}
    //                 onDelete={async (id) => {
    //                     return true;
    //                 }}
    //             />
    //         </List>
    //     </Box>
    // );
};

export default App;
