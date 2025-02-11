import { EventEmitter } from 'stream';

class KawaiFileWatcher {
    static __instance: KawaiFileWatcher | null = null;

    m_event_emitter: EventEmitter;
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
}
