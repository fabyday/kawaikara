
type KawaiId = string;

export class KawaiCategoryBase {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export interface IKawaiMenu {
    id: string;
    category: string;
    activate?: () => void; // if activate exists then menu manager doesn't emit event.
    getFaviconUrl? : ()=>string
}

export class KawaiMenuBase implements IKawaiMenu{
    id: string;
    category: string;

    constructor(id: string, category: string) {
        this.id = id;
        this.category = category;
    }
}
