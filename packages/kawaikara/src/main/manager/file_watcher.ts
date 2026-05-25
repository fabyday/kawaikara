import { EventEmitter } from 'stream';
import chokidar, { FSWatcher } from 'chokidar';
import { default_app_states_path, plugin_root_path } from '../component/constants';

class KawaiFileWatcher {
    static __instance: KawaiFileWatcher | null = null;

    m_event_emitter: EventEmitter;
    m_file_watcher : FSWatcher | null = null;
    static getInstance() {
        if (KawaiFileWatcher.__instance) {
            KawaiFileWatcher.__instance = new KawaiFileWatcher();
        }
        return KawaiFileWatcher.__instance;
    }

    private constructor() {
        this.m_event_emitter = new EventEmitter();
        this.m_event_emitter.setMaxListeners(50);



    }


    public async initialize(){
        this.initFileWatcher();
    }

    protected async initFileWatcher(){
        this.m_file_watcher = chokidar.watch(plugin_root_path).on("all", (event, path)=>{

        })
        this.m_file_watcher.on("add", (path)=>{})
        this.m_file_watcher.on("change", (path, stats)=>{})
        this.m_file_watcher.on("error", (err)=>{})
        
    }


    public on(type : "s"|"s",callback : ()=>Promise<void>){

    }


}
