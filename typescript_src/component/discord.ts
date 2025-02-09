import * as RPC from 'discord-rpc';
import * as dotenv from 'dotenv';
import { default_locale_directory, project_root } from './constants';
import path from 'path';
import { log } from '../logging/logger';

if (process.env.IS_DEV) {
    dotenv.config({ path: path.join(project_root, '.env') });
}

let discord_rpc: RPC.Client | null = null;
function get_rpc_client() {
    if (discord_rpc == null) {
        discord_rpc = new RPC.Client({ transport: 'ipc' });
    }
    return discord_rpc;
}

export async function set_activity() {
    const rpc = get_rpc_client();

    rpc.on('ready', () => {
        rpc.setActivity({
            details: 'Mecha Kawaii OTT Viewer',
            state: 'Watching...',
            startTimestamp: Date.now(),
            largeImageKey: 'discord1024',
            largeImageText: 'BIG Kawaikara',
            smallImageKey: 'discord512',
            smallImageText: 'CHIBI Kawaikara',
        });
    });
    
    rpc.login({
        clientId: process.env.DISCORD_APP_ID!,
        clientSecret: process.env.DISCORD_PUB_KEY!,
    }).catch(log.error);
}
